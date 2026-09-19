/**
 * The setup-statement extraction loop and the context seeding that follows
 * it, shared verbatim by both front ends (LT-202, ADR 0032 sub-design 6:
 * the anti-drift half of the dual front-end contract) — a change to either
 * lands on both surfaces at once. Front-end-neutral like the other
 * front-end stage modules: no parser values, only the loose `AstNode`
 * structural type; the node walks are estree-generic.
 */

import type { AstNode } from './ast-node'
import {
	asArray,
	CLIENT_ONLY_PRIMITIVES,
	CONTEXT_NAMES,
	freeIdentifiers,
	identifierName,
	isNode,
	JS_GLOBALS,
	MANAGED_TEXT_PROPS,
	PARSER_FACTORIES,
	SIGNAL_CONSTRUCTORS,
	text,
} from './ast-utils'
import { diagnostic } from './diagnostics'
import { inferType, type TypeContext } from './infer-type'
import type {
	ExposeKind,
	ExtractContext,
	SetupStmt,
	SignalConstructor,
	SignalIR,
	SourceRange,
} from './ir'
import { lineFields, resolutionOf } from './tier'

/** One `const name = first(selector, required?)` element reference (LT-055). */
export type ElementRefEntry = {
	selectorText: string
	reasonText: string | null
	maybe: boolean
	node: AstNode
}

/** One Parser-backed expose() initializer (`prop: asString(…)`). */
export type ParserExposeEntry = {
	parser: string
	fallbackText: string | null
	fallbackNode: AstNode | null
}

/**
 * Everything the setup-statement loop extracts. `signalByName` is the
 * lowered-template lookup map (not an IR field — the IR carries `signals`
 * and `exposeProps` etc.); the rest map 1:1 onto `ComponentIR` fields.
 */
export type SetupExtraction = {
	setup: SetupStmt[]
	clientSetup: SetupStmt[]
	plainSetup: SetupStmt[]
	signals: SignalIR[]
	signalByName: Map<string, SignalIR>
	setupInits: Map<string, AstNode>
	elementRefs: Map<string, ElementRefEntry>
	exposeText: string | null
	exposeRange: SourceRange | null
	exposeArgNode: AstNode | null
	exposeProps: Map<string, string>
	exposeKinds: Map<string, ExposeKind>
	exposedPropNames: Set<string>
	parserExposeProps: Map<string, ParserExposeEntry>
	exposeAmbients: Set<string>
	contextRefs: Set<string>
}

/** Shared empty result for the `parserFallbackRefsOf` context hook. */
const EMPTY_NAMES: ReadonlySet<string> = new Set<string>()

/** Signal constructors whose result is MUTABLE, hence Slot-backed. */
const MUTABLE_SIGNAL_CONSTRUCTORS: ReadonlySet<string> = new Set<string>([
	'createCell',
	'createState',
	'createList',
	'createStore',
])

/**
 * Which of `#setAccessor`'s three landings an `expose()` initializer takes
 * (LT-158) — see `ExposeKind`. One-sided on purpose: everything unrecognized
 * classifies as `slot`, the answer that raises no diagnostic, so a shape this
 * compiler has not met falls through to the Tier 2 runtime check instead of
 * failing a build on a guess (ADR 0028 sub-design 1).
 */
const classifyExposeInit = (
	value: unknown,
	signalByName: ReadonlyMap<string, SignalIR>,
): ExposeKind => {
	if (!isNode(value)) return 'slot'
	// `defineMethod(…)` → a plain member; `asString(…)` and friends → the
	// Parser's RESULT reaches `#setAccessor`, so a Parser is Slot-backed.
	if (value.type === 'CallExpression') {
		const callee = identifierName(value.callee)
		if (callee === 'defineMethod') return 'method'
		return 'slot'
	}
	// `sig.get` — a bare function, so `deriveCell` wraps it read-only
	// however mutable `sig` is. The single most common expose shape in the
	// corpus, and the one ADR 0011's motivating example is built on.
	if (
		value.type === 'MemberExpression' &&
		identifierName(value.property) === 'get'
	)
		return 'computed'
	if (
		value.type === 'ArrowFunctionExpression' ||
		value.type === 'FunctionExpression'
	)
		return 'computed'
	// `{ get, set }` is a SlotDescriptor; a `get`-only object literal is
	// one too (`isSlotDescriptor` requires only `get`), but it can never be
	// written through, so it is reported as read-only.
	if (value.type === 'ObjectExpression') {
		const keys = asArray(value.properties)
			.filter(prop => prop.type === 'Property')
			.map(prop => identifierName(prop.key))
		if (keys.includes('get')) return keys.includes('set') ? 'slot' : 'computed'
		return 'slot'
	}
	// A bare signal identifier: mutable constructors give a Slot, derived
	// ones do not.
	if (value.type === 'Identifier') {
		const signal = signalByName.get(identifierName(value) ?? '')
		if (signal)
			return MUTABLE_SIGNAL_CONSTRUCTORS.has(String(signal.constructor))
				? 'slot'
				: 'computed'
	}
	return 'slot'
}

/**
 * The setup-statement extraction loop, shared verbatim by both front ends
 * (LT-202). Classifies each statement: single-const declarations (signals
 * vs. helpers), `first()` element references, `expose()`, and client-only
 * side effects — everything else is diagnosed. ADR 0029's setup routing
 * signals (LTC013/LTC043 shapes) are pushed here, at the same sites that
 * raised the pre-LT-165 diagnostics.
 *
 * `importedNames` are the authored import bindings (plain or real
 * `@zeix/le-truc` exports, LT-088) — a bare client-only setup statement
 * (e.g. `throttle()` inside a `watch(() => el, () => { ... })` connect-time
 * effect) can freely reference either kind: `imports.ts`'s placement
 * inference already walks `clientSetup` free names
 * (`computeClientNeededNames`) to decide where each import lands, so a name
 * recognized here is guaranteed to resolve once emitted, exactly like
 * `setupInits`/`elementRefs` before it.
 */
export const extractSetup = (
	ctx: ExtractContext,
	setupStmts: AstNode[],
	paramsNode: AstNode | null,
	paramNames: ReadonlySet<string>,
	importedNames: ReadonlySet<string>,
): SetupExtraction => {
	const source = ctx.source
	const setup: SetupStmt[] = []
	const clientSetup: SetupStmt[] = []
	// Plain (non-signal) setup consts (LT-034 follow-up fix): `component.setup`
	// is emitted verbatim into the SERVER module only (`emit-server.ts`) —
	// this subset also needs emitting into the CLIENT factory, since a plain
	// const is documented (ast-utils.ts, diagnostics.ts) as available in
	// both, but nothing previously emitted it client-side. Signals are
	// excluded (already client-emitted via harvest); `expose()` is excluded
	// (already client-emitted separately).
	const plainSetup: SetupStmt[] = []
	const signals: SignalIR[] = []
	const signalByName = new Map<string, SignalIR>()
	const setupInits = new Map<string, AstNode>()
	/**
	 * `const name = first(selector, required)` declarations (LT-055),
	 * pending post-lowering resolution — the template doesn't exist yet at
	 * this point in the setup-statement loop (lowering runs later), and
	 * structurally matching the selector against template elements needs
	 * the template. Resolved once `root` exists, in `resolveTemplateOutput`.
	 * `maybe` marks the one-literal OPTIONAL form (LT-123), which
	 * is verified only where the template can speak to it.
	 */
	const elementRefs = new Map<string, ElementRefEntry>()
	let exposeText: string | null = null
	let exposeRange: SourceRange | null = null
	let exposeArgNode: AstNode | null = null
	const exposeProps = new Map<string, string>()
	const exposeKinds = new Map<string, ExposeKind>()
	/** Every name `expose()` declares — see the loop below. */
	const exposedPropNames = new Set<string>()
	const parserExposeProps = new Map<string, ParserExposeEntry>()
	const exposeAmbients = new Set<string>()
	const contextRefs = new Set<string>()
	const typeCtx: TypeContext = { paramsNode, setupInits }
	for (const stmt of setupStmts) {
		if (stmt.type === 'VariableDeclaration') {
			const declarations = asArray(stmt.declarations)
			const decl = declarations[0] ?? null
			const declName = identifierName(decl?.id)
			if (
				stmt.kind !== 'const' ||
				declarations.length !== 1 ||
				!declName ||
				!isNode(decl?.init)
			) {
				ctx.diagnostics.push(
					diagnostic.unsupported(
						source,
						stmt.start,
						'Setup statements other than single-const declarations',
					),
				)
				continue
			}
			const init = (decl as AstNode).init as AstNode
			// `first(selector, required)` element reference (LT-055, replacing
			// `ref={}`): doesn't exist server-side and has no server
			// substitution the way `requestContext` does, so it must never
			// reach `setup`/`setupInits`/`serverKnown` at all — a name known
			// there but never actually declared server-side would suppress the
			// `exposeArgNode` `any`-stub below for a name that genuinely needs
			// it (same as `ref={}` names, which never entered these either).
			// Handled entirely separately, before the generic push/set below.
			if (identifierName(init.callee) === 'first') {
				const args = asArray(init.arguments)
				const [selectorArg, reasonArg] = args
				const selectorText =
					selectorArg?.type === 'Literal' &&
					typeof selectorArg.value === 'string'
						? selectorArg.value
						: null
				const reasonText =
					reasonArg?.type === 'Literal' && typeof reasonArg.value === 'string'
						? reasonArg.value
						: null
				// One literal (a selector alone) is the OPTIONAL form
				// (LT-123): the reference may be absent at activation
				// and effects over it register under a presence guard.
				// Two literals (selector + required-reason) is the
				// required form. Anything else is LTC025.
				const validArity = args.length === 1 || args.length === 2
				if (
					!validArity ||
					selectorText === null ||
					(args.length === 2 && reasonText === null)
				)
					ctx.diagnostics.push(
						diagnostic.invalidFirstCall(source, stmt.start, declName),
					)
				else {
					elementRefs.set(declName, {
						selectorText,
						reasonText,
						maybe: args.length === 1,
						node: init,
					})
				}
				continue
			}
			setupInits.set(declName, init)
			const setupStmt: SetupStmt = {
				text: text(ctx.source, stmt),
				range: {
					start: typeof stmt.start === 'number' ? stmt.start : 0,
					end: typeof stmt.end === 'number' ? stmt.end : 0,
				},
				node: init,
				name: declName,
			}
			setup.push(setupStmt)
			// LT-125: this statement is now bound for the SERVER render function
			// too (`emit-server.ts` re-declares `component.setup` verbatim), so
			// an initializer that reads a `first()`-bound ref evaluates where no
			// DOM exists. Reported here, at the push, rather than in the
			// branches below, because it holds for every initializer shape
			// alike — signal constructor, requestContext, or plain.
			//
			// A FUNCTION initializer is exempt: a setup helper is defined but
			// never called server-side, so its ref reads never evaluate (that is
			// form-spinbutton's `commit`/`typed`/`stepBy`, and rejecting it would
			// reject the corpus). Everything else is evaluated, including a
			// compute thunk handed to a derived constructor.
			if (!/Function(Expression)?$/.test(String(init.type))) {
				const refReads = [...freeIdentifiers(init)]
					.filter(n => elementRefs.has(n))
					.sort()
				if (refReads.length > 0) {
					// ADR 0029 sub-design 5 (LT-165 step 5): a ROUTING SIGNAL,
					// not a diagnostic. The realm has a real DOM, so the ref
					// read the value harness could not evaluate is exactly what
					// phase 2 answers — and the component routes Simulated so
					// the tier-aware emit drops the statement from the server
					// module instead of refusing the file.
					ctx.routingSignals.push({
						origin: 'LTC043',
						detail: `\`${declName}\` reads element ref(s) ${refReads.join(', ')} in setup`,
						...lineFields(source, stmt.start),
						resolution: { by: 'realm' },
					})
				}
			}
			const calleeName = identifierName(init.callee)
			if (calleeName === 'requestContext') {
				// Consumer side of the context protocol (LT-035, ADR 0024
				// sub-design 15): `const motion = requestContext(MEDIA_MOTION,
				// 'unknown')`. Recognized separately from SIGNAL_CONSTRUCTORS —
				// `requestContext` has no server behavior at all (it dispatches a
				// DOM event against `host`), so the server substitutes the
				// fallback argument as the signal's render-time value instead of
				// running the call (emit-server.ts). The fallback must therefore
				// be resolvable with what's server-known so far (params + prior
				// setup names) — the same names `ctx.serverKnown` is built from.
				const args = asArray(init.arguments)
				if (args.length !== 2) {
					ctx.diagnostics.push(
						diagnostic.invalidRequestContextCall(source, stmt.start, declName),
					)
				} else {
					const fallbackNode = args[1] as AstNode
					const knownSoFar = new Set([...paramNames, ...setupInits.keys()])
					const badFallbackNames = [...freeIdentifiers(fallbackNode)].filter(
						n => !JS_GLOBALS.has(n) && !knownSoFar.has(n),
					)
					if (badFallbackNames.length > 0) {
						ctx.diagnostics.push(
							diagnostic.contextFallbackNotServerKnown(
								source,
								stmt.start,
								declName,
								badFallbackNames,
							),
						)
					} else {
						const signal: SignalIR = {
							name: declName,
							text: text(ctx.source, init),
							textStart: typeof init.start === 'number' ? init.start : 0,
							constructor: 'requestContext',
							init: fallbackNode,
							inferredType: inferType(fallbackNode, typeCtx),
							fallbackText: text(ctx.source, fallbackNode),
						}
						signals.push(signal)
						signalByName.set(declName, signal)
						contextRefs.add('requestContext')
					}
				}
			} else if (calleeName && SIGNAL_CONSTRUCTORS.has(calleeName)) {
				const args = asArray(init.arguments)
				const computeArg = args[0] ?? null
				// deriveCell/deriveStore/createMemo invoke their compute function
				// synchronously at server-render time too (runtime.ts) — a
				// host/internals read inside it would crash, since every signal
				// declaration is re-emitted verbatim into both modules (ADR 0023
				// sub-design 12; surfaced by LT-025's createMemo support).
				const isDerivedCallback =
					(calleeName === 'deriveCell' ||
						calleeName === 'deriveStore' ||
						calleeName === 'createMemo') &&
					isNode(computeArg) &&
					/Function(Expression)?$/.test(computeArg.type)
				const badContextNames = isDerivedCallback
					? [...freeIdentifiers(computeArg as AstNode)].filter(n =>
							CONTEXT_NAMES.has(n),
						)
					: []
				if (badContextNames.length > 0) {
					// ADR 0029 sub-design 5 (LT-165 step 5): a ROUTING SIGNAL,
					// not a diagnostic — `host`/`internals` resolve in the
					// realm, which is the whole difference between the harness
					// and phase 2. The declaration still has to exist somewhere
					// the component can run it: registered as a plain setup
					// const, so the generated CLIENT module emits it when its
					// name is needed (`computeClientNeededNames`), while the
					// Simulated-tier server module drops it (`retainReferenced`
					// — no server-known name can reach the markup).
					plainSetup.push(setupStmt)
					ctx.routingSignals.push({
						origin: 'LTC013',
						detail: `\`${declName}\`'s ${calleeName}() compute reads ${badContextNames.join('/')}`,
						...lineFields(source, stmt.start),
						resolution: resolutionOf(init, ctx.serverKnown),
					})
				} else {
					const signal: SignalIR = {
						name: declName,
						text: text(ctx.source, init),
						textStart: typeof init.start === 'number' ? init.start : 0,
						constructor: calleeName as SignalConstructor,
						init: computeArg,
						inferredType: inferType(computeArg, typeCtx),
						fallbackText: null,
					}
					signals.push(signal)
					signalByName.set(declName, signal)
				}
			} else if (init.type === 'ConditionalExpression') {
				// A ternary between two constructor calls isn't recognized as a
				// signal at all (no single `.callee`) — diagnose it explicitly
				// rather than silently treating it as an ordinary setup const
				// (ADR 0023 sub-design 12).
				const consequentName = identifierName(
					(init.consequent as AstNode | undefined)?.callee,
				)
				const alternateName = identifierName(
					(init.alternate as AstNode | undefined)?.callee,
				)
				if (
					consequentName &&
					SIGNAL_CONSTRUCTORS.has(consequentName) &&
					alternateName &&
					SIGNAL_CONSTRUCTORS.has(alternateName)
				) {
					ctx.diagnostics.push(
						diagnostic.conditionalSignalConstructor(
							source,
							stmt.start,
							declName,
						),
					)
				} else {
					plainSetup.push(setupStmt)
				}
			} else {
				plainSetup.push(setupStmt)
				// A plain setup const calling a client-only primitive directly —
				// the value harness cannot run it (ADR 0023 sub-design 12).
				// ADR 0029 sub-design 5 (LT-165 step 5): a ROUTING SIGNAL, not
				// a diagnostic — the const already sits in `plainSetup`, so the
				// generated CLIENT module emits it when needed and the
				// Simulated-tier server module drops it.
				const badPrimitives = [...freeIdentifiers(init)]
					.filter(n => CLIENT_ONLY_PRIMITIVES.has(n))
					.sort()
				if (badPrimitives.length > 0) {
					ctx.routingSignals.push({
						origin: 'LTC013',
						detail: `\`${declName}\` calls client-only primitive(s) ${badPrimitives.join(', ')}`,
						...lineFields(source, stmt.start),
						resolution: resolutionOf(init, ctx.serverKnown),
					})
				}
			}
			continue
		}
		// React's component-return idiom (LT-054): the template is the surface
		// module's output expression, not a `return` in setup. Diagnosed with
		// a dedicated fix-it rather than falling through to the generic
		// "unsupported statement" message below.
		if (
			stmt.type === 'ReturnStatement' &&
			isNode((stmt as AstNode).argument) &&
			['JSXElement', 'JSXFragment'].includes(
				String(((stmt as AstNode).argument as AstNode).type),
			)
		) {
			ctx.diagnostics.push(diagnostic.reactReturnJsx(source, stmt.start))
			continue
		}
		// The client-only free-name gate (LT-008, widened by LT-069/087/088):
		// a name resolves client-side when it is a JS global, a context
		// member, a signal, an expose ambient, a `first()`-bound element
		// local, an earlier setup const, a composed-element ref, an authored
		// import binding, or a client-only FactoryContext primitive (watch/
		// on/pass/…). Used by bare client-only expression statements.
		const clientKnownName = (freeName: string): boolean => {
			if (JS_GLOBALS.has(freeName)) return true
			if (CONTEXT_NAMES.has(freeName)) {
				contextRefs.add(freeName)
				return true
			}
			if (signalByName.has(freeName)) return true
			if (exposeAmbients.has(freeName)) return true
			if (elementRefs.has(freeName)) return true
			if (setupInits.has(freeName)) return true
			if (importedNames.has(freeName)) return true
			if (CLIENT_ONLY_PRIMITIVES.has(freeName)) {
				contextRefs.add(freeName)
				return true
			}
			return false
		}
		const expression =
			stmt.type === 'ExpressionStatement'
				? (stmt.expression as AstNode | undefined)
				: undefined
		if (
			stmt.type === 'ExpressionStatement' &&
			identifierName(expression?.callee) === 'expose'
		) {
			exposeText = text(ctx.source, expression as AstNode)
			exposeRange = {
				start:
					typeof (expression as AstNode).start === 'number'
						? ((expression as AstNode).start as number)
						: 0,
				end:
					typeof (expression as AstNode).end === 'number'
						? ((expression as AstNode).end as number)
						: 0,
			}
			// prop → signal from expose({ prop: signal.get })
			const arg = asArray(expression?.arguments)[0] ?? null
			exposeArgNode = arg
			setup.push({
				text: exposeText,
				range: exposeRange,
				node: arg ?? (expression as AstNode),
				name: null,
			})
			for (const name of freeIdentifiers(
				arg ??
					({ type: 'ObjectExpression', properties: [] } as unknown as AstNode),
			)) {
				if (CONTEXT_NAMES.has(name)) contextRefs.add(name)
			}
			for (const prop of asArray(arg?.properties)) {
				if (prop.type !== 'Property') continue
				const propName = identifierName(prop.key)
				const value = prop.value
				// EVERY declared prop name, whatever its initializer
				// shape. The two maps below only record the initializer
				// KINDS they each lower (signal getters, Parser
				// factories) — a prop harvested straight from the DOM
				// (`label: labelSpan.textContent ?? ''`) is neither, so
				// before LT-122 it was exposed at runtime but invisible
				// to the compiler, which `ExtractContext.exposedProps`
				// already claimed to list ("prop names `expose()`
				// declares").
				if (propName) exposedPropNames.add(propName)
				// LT-158: which of `#setAccessor`'s three landings this
				// initializer takes, so another file's `pass={{ }}` can be
				// decided against it. Default `slot` — the shape that makes
				// no diagnostic — so an initializer this classifier does not
				// recognize falls back to the Tier 2 runtime check rather
				// than failing a build on a guess.
				if (propName)
					exposeKinds.set(propName, classifyExposeInit(value, signalByName))
				if (
					propName &&
					isNode(value) &&
					value.type === 'MemberExpression' &&
					identifierName(value.property) === 'get'
				) {
					const sigName = identifierName(value.object)
					if (sigName) exposeProps.set(propName, sigName)
				}
				// Parser-backed attribute-driven props and method producers:
				// the initializer is an ambient factory call, verbatim in the
				// generated client (imports) and shimmed on the server.
				if (propName && isNode(value) && value.type === 'CallExpression') {
					const callee = identifierName(value.callee)
					if (callee && PARSER_FACTORIES.has(callee)) {
						const fallback = asArray(value.arguments)[0] ?? null
						parserExposeProps.set(propName, {
							parser: callee,
							fallbackText: fallback ? text(ctx.source, fallback) : null,
							fallbackNode: fallback,
						})
						exposeAmbients.add(callee)
					} else if (callee === 'defineMethod') {
						exposeAmbients.add(callee)
					}
				}
			}
			continue
		}
		if (stmt.type === 'ExpressionStatement' && expression) {
			// Client-only setup side effect (LT-008): connect-time statements
			// (`internals?.states.add('clearable')`) whose free names are all
			// client-known — context members, signals, expose ambients, JS
			// globals, earlier plain setup consts, `first()`-bound element
			// locals, `ref={}`-bound composed-element locals (LT-087), and the
			// `watch`/`on`/`pass` ambients (LT-069) — those touch connect-time
			// APIs (ElementInternals, DOM, ResizeObserver/pointer capture) that
			// don't exist render-time, same posture as the pre-existing cases.
			// A plain-const reference is picked up client-side automatically:
			// `imports.ts`'s `computeClientNeededNames` already walks
			// `clientSetup` nodes' free names into its plain-setup fixpoint.
			const bad = [...freeIdentifiers(expression)].filter(
				n => !clientKnownName(n),
			)
			if (bad.length === 0) {
				clientSetup.push({
					text: text(ctx.source, stmt),
					range: {
						start: typeof stmt.start === 'number' ? stmt.start : 0,
						end: typeof stmt.end === 'number' ? stmt.end : 0,
					},
					node: expression,
					name: null,
				})
				continue
			}
		}
		ctx.diagnostics.push(
			diagnostic.unsupported(
				source,
				stmt.start,
				'Setup statements other than const declarations, expose(), and client-only side effects (over host/internals/signals)',
			),
		)
	}
	return {
		setup,
		clientSetup,
		plainSetup,
		signals,
		signalByName,
		setupInits,
		elementRefs,
		exposeText,
		exposeRange,
		exposeArgNode,
		exposeProps,
		exposeKinds,
		exposedPropNames,
		parserExposeProps,
		exposeAmbients,
		contextRefs,
	}
}

/**
 * Seed the extraction context from the setup extraction: the server-known
 * name set (args + signals + setup consts), the caller-supplied arg names
 * LT-122 consults alone, the exposed-prop set the lift rule consults for
 * LTC019, and the Parser hooks. Runs after setup extraction and before
 * template lowering.
 *
 * `config` has not been parsed yet when the managed form props are included
 * unconditionally — a string-literal `'validationMessage'` child is the
 * retired spelling whether or not formAssociated() is on.
 */
export const seedExtractionContext = (
	ctx: ExtractContext,
	{
		paramNames,
		extraction,
	}: {
		paramNames: ReadonlySet<string>
		extraction: SetupExtraction
	},
): void => {
	// @if conditions validate against server-known names — args and setup
	// declarations, all parsed by this point. `isPending` is included: the
	// server harness always provides it (the generated module binds it from
	// the harness whenever its emitted text references it), so a reactive
	// thunk reading `isPending(knownSignal)` folds server-side. This does
	// NOT reopen `@if` over signals — `validateCondition` diagnoses signal
	// reads before the unknown-name check.
	ctx.serverKnown = new Set<string>([...paramNames, 'isPending'])
	// LT-122 consults the caller-supplied names alone (see
	// `ExtractContext.argNames`), so they are kept apart from the
	// signals/setup consts folded into `serverKnown` below.
	ctx.argNames = new Set<string>(paramNames)
	for (const s of extraction.signals) ctx.serverKnown.add(s.name)
	for (const n of extraction.setupInits.keys()) ctx.serverKnown.add(n)
	ctx.setupInits = extraction.setupInits
	for (const prop of extraction.exposedPropNames) ctx.exposedProps.add(prop)
	for (const prop of extraction.exposeProps.keys()) ctx.exposedProps.add(prop)
	for (const prop of extraction.parserExposeProps.keys()) {
		ctx.exposedProps.add(prop)
		ctx.parserProps.add(prop)
	}
	ctx.parserFactoryOf = (prop: string): string =>
		extraction.parserExposeProps.get(prop)?.parser ?? ''
	ctx.parserFallbackRefsOf = (prop: string): ReadonlySet<string> => {
		const fallback = extraction.parserExposeProps.get(prop)?.fallbackNode
		if (!fallback) return EMPTY_NAMES
		return new Set(
			[...freeIdentifiers(fallback)].filter(n => extraction.elementRefs.has(n)),
		)
	}
	for (const prop of MANAGED_TEXT_PROPS) ctx.exposedProps.add(prop)
}
