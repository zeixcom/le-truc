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
	freeIdentifiers,
	getterObjectName,
	identifierName,
	isGetterMember,
	isNode,
	text,
} from './ast-utils'
import { diagnostic } from './diagnostics'
import type { ExtractContext } from './extract-context'
import { staticMessageReads } from './i18n'
import { inferType, type TypeContext } from './infer-type'
import type {
	DeclaredSignalIR,
	DerivedSignalIR,
	ExposeKind,
	ExposePropDecl,
	ExposeStmt,
	ItemSetupStmt,
	SetupStmt,
	SignalIR,
	SourceRange,
} from './ir'
import { type Resolution, rangeFields, resolutionOf } from './tier'
import {
	CLIENT_ONLY_PRIMITIVES,
	CONTEXT_NAMES,
	JS_GLOBALS,
	MANAGED_TEXT_PROPS,
	MUTABLE_SIGNAL_CONSTRUCTORS,
	PARSER_FACTORIES,
	SIGNAL_CONSTRUCTORS,
} from './vocabulary'

/** One `const name = first(selector, required?)` element reference (LT-055). */
export type ElementRefEntry = {
	selectorText: string
	reasonText: string | null
	maybe: boolean
	node: AstNode
}

/**
 * Everything the setup-statement loop extracts. `signalByName` is the
 * lowered-template lookup map (not an IR field — the IR carries `signals`
 * and `exposeProps`); the rest map 1:1 onto `ComponentIR` fields, except
 * `elementRefs`, which template-output resolution turns into `firstRefs`.
 */
export type SetupExtraction = {
	setup: SetupStmt[]
	clientSetup: SetupStmt[]
	plainSetup: SetupStmt[]
	signals: SignalIR[]
	signalByName: Map<string, SignalIR>
	setupInits: Map<string, AstNode>
	elementRefs: Map<string, ElementRefEntry>
	expose: ExposeStmt | null
	exposeProps: Map<string, ExposePropDecl>
	contextRefs: Set<string>
	/** The authored import bindings the client gate admitted. */
	importedNames: ReadonlySet<string>
	/** The client message channel the client gate admitted. */
	messages: {
		tNames: ReadonlySet<string>
		declaredKeys: Readonly<Record<string, string>>
	}
}

/** Shared empty result for the `parserFallbackRefsOf` context hook. */
const EMPTY_NAMES: ReadonlySet<string> = new Set<string>()

/** Which phase binds a name an item's setup statement reads. */
type ItemNameClass = 'both' | 'client' | 'server' | 'unknown'

/** A list of names as message copy: `` `a` and `b` ``. */
const nameList = (names: readonly string[]): string =>
	names.map(n => `\`${n}\``).join(' and ')

/** The setup refusal component setup reports, verbatim (ADR 0046 s5). */
const setupStatementRefusal = (ctx: ExtractContext, stmt: AstNode) =>
	diagnostic.unsupported(
		ctx.source,
		stmt,
		'A setup statement other than a `const` declaration, `expose()` or a client-only side effect over `host`, `internals` or signals',
		'Move the logic into a `const` initializer, or into a `watch()` or `on()` handler.',
	)

/** Is `node` a function expression (an initializer defined, not called)? */
const isFunctionNode = (node: unknown): node is AstNode =>
	isNode(node) && /Function(Expression)?$/.test(String(node.type))

/**
 * Why a `createSensor(start, options)` call has no server value, or null
 * when it has one (ADR 0046 s5): the `value` seed is the server value, so
 * a sensor without one is unresolvable, and so is a seed that reads a
 * stubbed API or a non-server fact (`resolutionOf`'s own limbs).
 */
const sensorSeedResolution = (
	options: unknown,
): Extract<Resolution, { by: 'none' }> | null => {
	const seed =
		isNode(options) && options.type === 'ObjectExpression'
			? asArray(options.properties).find(
					(p): p is AstNode =>
						isNode(p) &&
						p.type === 'Property' &&
						!p.computed &&
						identifierName(p.key) === 'value',
				)?.value
			: undefined
	if (!isNode(seed))
		return {
			by: 'none',
			limb: 'not-a-server-fact',
			reason:
				'has no `{ value }` seed, so its first value comes from a client source after connect',
		}
	const resolution = resolutionOf(seed, EMPTY_NAMES)
	return resolution.by === 'none' ? resolution : null
}

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
	if (isGetterMember(value)) return 'computed'
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
		if (signal) return signal.family === 'declared' ? 'slot' : 'computed'
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
	/**
	 * The client message channel (ADR 0030 s9, LT-349): the component's `t`
	 * bindings and declared keys. A client-only statement reading a declared
	 * key statically (`t.outOfGamut`) passes the gate below.
	 */
	messages: {
		tNames: ReadonlySet<string>
		declaredKeys: Readonly<Record<string, string>>
	} = { tNames: new Set(), declaredKeys: {} },
): SetupExtraction => {
	const source = ctx.source
	const setup: SetupStmt[] = []
	const clientSetup: SetupStmt[] = []
	// Plain (non-signal) setup consts (LT-034 follow-up fix): `component.setup`
	// is emitted verbatim into the SERVER module only (`emit-server.ts`) —
	// this subset also needs emitting into the CLIENT factory, since a plain
	// const is documented (vocabulary.ts, diagnostics.ts) as available in
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
	let expose: ExposeStmt | null = null
	const exposeProps = new Map<string, ExposePropDecl>()
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
						stmt,
						'A setup declaration other than a single initialized `const`',
						'Declare one initialized `const` per statement.',
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
			// `expose.argNode` `any`-stub below for a name that genuinely needs
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
						diagnostic.invalidFirstCall(source, stmt, declName),
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
						...rangeFields(source, stmt),
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
						diagnostic.invalidRequestContextCall(source, stmt, declName),
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
								stmt,
								declName,
								badFallbackNames,
							),
						)
					} else {
						const signal: SignalIR = {
							name: declName,
							text: text(ctx.source, init),
							textStart: typeof init.start === 'number' ? init.start : 0,
							family: 'context',
							constructor: 'requestContext',
							fallback: fallbackNode,
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
				// declaration is re-emitted verbatim into both modules (ADR 0024
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
						...rangeFields(source, stmt),
						resolution: resolutionOf(init, ctx.serverKnown),
					})
				} else {
					const base = {
						name: declName,
						text: text(ctx.source, init),
						textStart: typeof init.start === 'number' ? init.start : 0,
						init: computeArg,
						inferredType: inferType(computeArg, typeCtx),
					}
					// A sensor's server value is its `{ value }` seed (ADR 0046
					// s5). Without one — or with one no server phase can answer
					// — every read is unresolvable (ADR 0029 s5): the sensor
					// stays out of `serverKnown`, so each read site is omitted.
					const sensorResolution =
						calleeName === 'createSensor' ? sensorSeedResolution(args[1]) : null
					if (sensorResolution)
						ctx.routingSignals.push({
							origin: 'LTC013',
							detail: `\`${declName}\`'s createSensor() has no server value`,
							...rangeFields(source, stmt),
							resolution: sensorResolution,
						})
					const signal: SignalIR = MUTABLE_SIGNAL_CONSTRUCTORS.has(calleeName)
						? {
								...base,
								family: 'declared',
								constructor: calleeName as DeclaredSignalIR['constructor'],
							}
						: {
								...base,
								family: 'derived',
								constructor: calleeName as DerivedSignalIR['constructor'],
								...(sensorResolution ? { unresolvable: true as const } : {}),
							}
					signals.push(signal)
					signalByName.set(declName, signal)
				}
			} else if (init.type === 'ConditionalExpression') {
				// A ternary between two constructor calls isn't recognized as a
				// signal at all (no single `.callee`) — diagnose it explicitly
				// rather than silently treating it as an ordinary setup const
				// (ADR 0024 sub-design 12).
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
						diagnostic.conditionalSignalConstructor(source, stmt, declName),
					)
				} else {
					plainSetup.push(setupStmt)
				}
			} else {
				plainSetup.push(setupStmt)
				// A plain setup const calling a client-only primitive directly —
				// the value harness cannot run it (ADR 0024 sub-design 12).
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
						...rangeFields(source, stmt),
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
			ctx.diagnostics.push(diagnostic.reactReturnJsx(source, stmt))
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
			const exposeText = text(ctx.source, expression as AstNode)
			const exposeRange: SourceRange = {
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
			expose = {
				text: exposeText,
				range: exposeRange,
				argNode: arg,
				ambients: [],
			}
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
				if (!propName) continue
				// EVERY declared prop name, whatever its initializer shape
				// (LT-122): a prop harvested straight from the DOM (`label:
				// labelSpan.textContent ?? ''`) is neither a signal getter
				// nor a Parser factory, but it is still exposed at runtime.
				// LT-158: `kind` is which of `#setAccessor`'s three landings
				// this initializer takes, so another file's `pass={{ }}` can
				// be decided against it. Default `slot` — the shape that
				// makes no diagnostic — so an initializer this classifier
				// does not recognize falls back to the Tier 2 runtime check
				// rather than failing a build on a guess.
				const decl: ExposePropDecl = {
					kind: classifyExposeInit(value, signalByName),
				}
				const getterOf = getterObjectName(value)
				if (getterOf) decl.signalName = getterOf
				// Parser-backed attribute-driven props and method producers:
				// the initializer is an ambient factory call, verbatim in the
				// generated client (imports) and shimmed on the server.
				if (isNode(value) && value.type === 'CallExpression') {
					const callee = identifierName(value.callee)
					if (callee && PARSER_FACTORIES.has(callee)) {
						const fallback = asArray(value.arguments)[0] ?? null
						decl.parser = {
							parser: callee,
							fallbackText: fallback ? text(ctx.source, fallback) : null,
							fallbackNode: fallback,
						}
						exposeAmbients.add(callee)
					} else if (callee === 'defineMethod') {
						exposeAmbients.add(callee)
					}
				} else if (
					isNode(value) &&
					!isGetterMember(value) &&
					value.type !== 'ObjectExpression' &&
					value.type !== 'ArrowFunctionExpression' &&
					value.type !== 'FunctionExpression' &&
					value.type !== 'Identifier'
				) {
					// LT-386: a plain-value initializer IS the prop's client seed
					// (`#initSignals` evaluates it once), so its expression is the
					// prop's server truth. Only plain value shapes are recorded —
					// a call's purity, a getter's body and a bare identifier's
					// referent are seeds the fold cannot vouch for.
					decl.initNode = value
				}
				exposeProps.set(propName, decl)
			}
			continue
		}
		if (stmt.type === 'ExpressionStatement' && expression) {
			// Client-only setup side effect (LT-008): connect-time statements
			// (`internals?.states.add('clearable')`) whose free names are all
			// client-known — context members, signals, expose ambients, JS
			// globals, earlier plain setup consts, `first()`-bound element
			// locals, `ref={}`-bound composed-element locals (LT-087), authored
			// non-compose import bindings (LT-088 — a shared client-only helper
			// module, ADR 0046 s5) and the `watch`/`on`/`pass` ambients
			// (LT-069) — those touch connect-time APIs (ElementInternals, DOM,
			// ResizeObserver/pointer capture) that don't exist render-time,
			// same posture as the pre-existing cases.
			// A plain-const reference is picked up client-side automatically:
			// `imports.ts`'s `computeClientNeededNames` already walks
			// `clientSetup` nodes' free names into its plain-setup fixpoint.
			// A static `t.<key>` read of a declared key is the one server
			// binding admitted (LT-349): the message preamble precedes these
			// statements, and `analysis/plan.ts` records the key into the
			// root `i18n` attribute. Any other unknown name still means the
			// statement may be server code.
			const bad = [...freeIdentifiers(expression)].filter(
				n =>
					!clientKnownName(n) &&
					!(
						messages.tNames.has(n) &&
						staticMessageReads(expression, n, messages.declaredKeys) !== null
					),
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
		ctx.diagnostics.push(setupStatementRefusal(ctx, stmt))
	}
	return {
		setup,
		clientSetup,
		plainSetup,
		signals,
		signalByName,
		setupInits,
		elementRefs,
		expose: expose && { ...expose, ambients: [...exposeAmbients].sort() },
		exposeProps,
		contextRefs,
		importedNames,
		messages,
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
	// An unresolvable signal (an unseeded sensor, ADR 0046 s5) has no server
	// value, so no read of it is server-known.
	for (const s of extraction.signals)
		if ('unresolvable' in s && s.unresolvable) ctx.serverKnown.delete(s.name)
	ctx.setupInits = extraction.setupInits
	for (const [prop, decl] of extraction.exposeProps) {
		ctx.exposedProps.add(prop)
		if (decl.parser) ctx.parserProps.add(prop)
	}
	ctx.parserFactoryOf = (prop: string): string =>
		extraction.exposeProps.get(prop)?.parser?.parser ?? ''
	ctx.parserFallbackRefsOf = (prop: string): ReadonlySet<string> => {
		const fallback = extraction.exposeProps.get(prop)?.parser?.fallbackNode
		if (!fallback) return EMPTY_NAMES
		return new Set(
			[...freeIdentifiers(fallback)].filter(n => extraction.elementRefs.has(n)),
		)
	}
	for (const prop of MANAGED_TEXT_PROPS) ctx.exposedProps.add(prop)
	ctx.setupScope = {
		importedNames: extraction.importedNames,
		refNames: new Set(extraction.elementRefs.keys()),
		tNames: extraction.messages.tNames,
		declaredKeys: extraction.messages.declaredKeys,
	}
}

/* === Per-item setup (ADR 0046 s5) === */

/**
 * Classify a reactive-list item's setup statements (ADR 0046 s5) by the
 * component-setup rules, with the item, the key and every enclosing item's
 * names known. Runs while the item and key are bound (`ctx.loopBound`);
 * `signals` are the signals in scope, enclosing items' included.
 *
 * A per-item statement runs in two places: per initial item in the
 * server's loop, and per entering item in `bindItem`. So a plain const and
 * a signal declaration read only names both phases bind — the item and
 * key, enclosing items' names, signals, setup consts, imports, globals.
 * The exceptions are positions the server defines but never calls: a
 * function const's body and a `createSensor` start callback may read
 * client-only names (`host`, refs, `on`), which the server leaves out or
 * stubs. Nothing may read a server arg: the client has none. A client-only
 * side effect is gated exactly like component setup's.
 */
export const extractItemSetup = (
	ctx: ExtractContext,
	stmts: readonly AstNode[],
	signals: ReadonlyMap<string, SignalIR>,
): { setup: ItemSetupStmt[]; signals: SignalIR[] } => {
	const { source } = ctx
	const scope = ctx.setupScope
	const setup: ItemSetupStmt[] = []
	const itemSignals: SignalIR[] = []
	const own = new Map<string, ItemNameClass>()
	const classOf = (name: string): ItemNameClass => {
		const mine = own.get(name)
		if (mine) return mine
		const bound = ctx.loopBound.lastIndexOf(name)
		if (bound >= 0) return ctx.loopReactive[bound] ? 'both' : 'server'
		if (signals.has(name) || ctx.setupInits.has(name)) return 'both'
		if (scope.refNames.has(name)) return 'client'
		if (CONTEXT_NAMES.has(name) || CLIENT_ONLY_PRIMITIVES.has(name))
			return 'client'
		if (ctx.argNames.has(name) || scope.tNames.has(name)) return 'server'
		if (JS_GLOBALS.has(name) || scope.importedNames.has(name)) return 'both'
		return 'unknown'
	}
	const namesOf = (node: AstNode, cls: ItemNameClass): string[] =>
		[...freeIdentifiers(node)].filter(n => classOf(n) === cls).sort()
	const rangeOfStmt = (stmt: AstNode): SourceRange => ({
		start: typeof stmt.start === 'number' ? stmt.start : 0,
		end: typeof stmt.end === 'number' ? stmt.end : 0,
	})
	/**
	 * Refuse a both-phase position reading a name one phase lacks; true
	 * when it was refused. `clientOnlyOk` admits client-only names (a
	 * position the server defines but never calls).
	 */
	const refusePhase = (
		stmt: AstNode,
		node: AstNode,
		subject: string,
		clientOnlyOk: boolean,
	): boolean => {
		const serverOnly = namesOf(node, 'server')
		if (serverOnly.length > 0) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					source,
					stmt,
					`${subject} reading ${nameList(serverOnly)}, which the item's client mount does not have,`,
					'Item setup also runs on the client, once per entering item, where server args and server-data loop bindings do not exist — read the value from the item or from a signal.',
				),
			)
			return true
		}
		const clientOnly = clientOnlyOk ? [] : namesOf(node, 'client')
		if (clientOnly.length > 0) {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					source,
					stmt,
					`${subject} reading ${nameList(clientOnly)}, which the server render does not have,`,
					'Item setup also runs on the server, once per initial item — read client-only names in a function const, a `createSensor()` start callback, or a `watch()` or `on()` handler.',
				),
			)
			return true
		}
		return false
	}

	for (const stmt of stmts) {
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
						stmt,
						'A setup declaration other than a single initialized `const`',
						'Declare one initialized `const` per statement.',
					),
				)
				continue
			}
			const init = (decl as AstNode).init as AstNode
			const base = {
				text: text(source, stmt),
				range: rangeOfStmt(stmt),
				node: init,
				name: declName,
			}
			const calleeName = identifierName(init.callee)
			// `first()` against the item's own `first` (ADR 0046 s2): resolved
			// against the item's content once it is lowered.
			if (calleeName === 'first') {
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
				if (
					(args.length !== 1 && args.length !== 2) ||
					selectorText === null ||
					(args.length === 2 && reasonText === null)
				) {
					ctx.diagnostics.push(
						diagnostic.invalidFirstCall(source, stmt, declName),
					)
					continue
				}
				setup.push({
					...base,
					kind: 'ref',
					selector: selectorText,
					reason: reasonText,
					required: args.length === 2,
					root: false,
				})
				own.set(declName, 'client')
				continue
			}
			if (calleeName === 'requestContext') {
				ctx.diagnostics.push(
					diagnostic.unsupported(
						source,
						stmt,
						"`requestContext()` in a reactive-list item's setup",
						'A context is requested once per component — request it in the component setup and read it in the item.',
					),
				)
				continue
			}
			if (calleeName && SIGNAL_CONSTRUCTORS.has(calleeName)) {
				const args = asArray(init.arguments)
				const subject = `The per-item signal \`${declName}\``
				if (calleeName === 'createSensor') {
					// The seed is the sensor's server value (ADR 0046 s5), and every
					// initial item renders from it.
					if (sensorSeedResolution(args[1]) !== null) {
						ctx.diagnostics.push(
							diagnostic.unsupported(
								source,
								stmt,
								`A per-item \`createSensor()\` without a server-known \`{ value }\` seed`,
								'The seed is the sensor’s server value, and the server renders every initial item from it — add `{ value: … }` over values both phases know.',
							),
						)
						continue
					}
					// The start callback subscribes on the client and never runs on
					// the server: client-only names are admitted there and stubbed.
					const [start, options] = args
					if (
						(isNode(start) &&
							refusePhase(stmt, start, subject, isFunctionNode(start))) ||
						(isNode(options) && refusePhase(stmt, options, subject, false))
					)
						continue
				} else if (refusePhase(stmt, init, subject, false)) continue
				const signalBase = {
					name: declName,
					text: text(source, init),
					textStart: typeof init.start === 'number' ? init.start : 0,
					init: args[0] ?? null,
					inferredType: 'unknown' as const,
				}
				itemSignals.push(
					MUTABLE_SIGNAL_CONSTRUCTORS.has(calleeName)
						? {
								...signalBase,
								family: 'declared',
								constructor: calleeName as DeclaredSignalIR['constructor'],
							}
						: {
								...signalBase,
								family: 'derived',
								constructor: calleeName as DerivedSignalIR['constructor'],
							},
				)
				setup.push({
					...base,
					kind: 'signal',
					constructor: calleeName as Exclude<
						SignalIR['constructor'],
						'requestContext'
					>,
				})
				own.set(declName, 'both')
				continue
			}
			if (init.type === 'ConditionalExpression') {
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
						diagnostic.conditionalSignalConstructor(source, stmt, declName),
					)
					continue
				}
			}
			// A plain const. A function is defined in both phases and called on
			// the client only, so its body may read client-only names — the
			// server then leaves it out.
			const isFunction = isFunctionNode(init)
			if (
				refusePhase(
					stmt,
					init,
					`The per-item const \`${declName}\``,
					isFunction,
				)
			)
				continue
			setup.push({
				...base,
				kind: 'const',
				server: !isFunction || namesOf(init, 'client').length === 0,
			})
			own.set(declName, 'both')
			continue
		}
		const expression =
			stmt.type === 'ExpressionStatement'
				? (stmt.expression as AstNode | undefined)
				: undefined
		if (identifierName(expression?.callee) === 'expose') {
			ctx.diagnostics.push(
				diagnostic.unsupported(
					source,
					stmt,
					"`expose()` in a reactive-list item's setup",
					'A component exposes its props once — call `expose()` in the component setup.',
				),
			)
			continue
		}
		if (expression) {
			// A client-only side effect, gated like component setup's: every
			// name client-known, a static `t.<key>` read of a declared key the
			// one server binding admitted (LT-349).
			const bad = [...freeIdentifiers(expression)].filter(n => {
				const cls = classOf(n)
				if (cls === 'both' || cls === 'client') return false
				return !(
					scope.tNames.has(n) &&
					staticMessageReads(expression, n, scope.declaredKeys) !== null
				)
			})
			if (bad.length === 0) {
				setup.push({
					text: text(source, stmt),
					range: rangeOfStmt(stmt),
					node: expression,
					name: null,
					kind: 'client',
				})
				continue
			}
		}
		ctx.diagnostics.push(setupStatementRefusal(ctx, stmt))
	}
	return { setup, signals: itemSignals }
}

/**
 * Whether the server's loop declares an item setup statement (ADR 0046
 * s5): every signal and every const but a function whose body reads a
 * client-only name. A ref and a client-only side effect are the client's.
 */
export const onServer = (stmt: ItemSetupStmt): boolean =>
	stmt.kind === 'signal' || (stmt.kind === 'const' && stmt.server)
