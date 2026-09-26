/**
 * The partial-readiness invariant as a compile-time check (ADR 0034
 * sub-design 4, LT-258): **a component's folded output may depend only on
 * its own props and a closed, enumerable set of page-ambient values.**
 *
 * Template emission (ADR 0034 sub-design 3, LT-257) turns the props into
 * template holes and passes the ambient set through the include. Anything
 * else a fold reads — the build page's `document`, the build machine's
 * `navigator`, a `window` global — has no hole to become, so a fold that
 * reads it forecloses emitting the component as a template. The check runs
 * now, before the emitter exists, so a design landing in between cannot do
 * that quietly.
 *
 * This module is the ONE place the invariant's vocabulary is declared:
 *
 * - {@link PAGE_AMBIENT_TYPES} / {@link PAGE_AMBIENTS} — the closed ambient set. Adding a member here is
 *   the visible, reviewable act that widens what every future emitter must
 *   pass through the include; nothing else widens it.
 * - {@link FOLD_HARNESS_NAMES} — names the server harness binds that are
 *   pure functions of the component's own state, not page inputs.
 * - {@link PAGE_CONTEXT_GLOBALS} — globals that read page or build-machine
 *   context. Several sit in `JS_GLOBALS` (the client analysis needs them),
 *   which is exactly why the server-evaluability gate admits them: it asks
 *   "is every name in scope", and a global always is.
 *
 * Two checks read it. `ambientRecordViolations` (called from the params
 * contract) keeps the reserved `i18n` record's destructured members inside
 * the set; `checkFoldInputs` (called from the shared pipeline) walks every
 * position the server render evaluates and reports a page-context read
 * there. Both report LTC054 — ADR 0028 tier 1 (Prevented), statically
 * decidable, no runtime half. `assertFoldScopeClosed` is the compiler-side
 * guard: it throws when the render scope (`serverKnown`) holds a name that
 * is neither an own arg, an own setup name, nor a declared harness name.
 *
 * The Simulated tier is outside the invariant by construction (ADR 0035
 * sub-design 2: SSG-only, never a template), so statements the realm owns —
 * the ones setup extraction routes, reading refs, `host`/`internals`, or a
 * client-only primitive — are not fold inputs and are not checked.
 *
 * Reconcile rider (ADR 0037, 2026-09-21): a reactive condition's INITIAL
 * winner is prop-dependent output — legal under this check, because its
 * inputs are the same args and ambients every other fold reads. How the
 * emitted backend conditional represents it is LT-257's to name.
 */

import type { AstNode } from './ast-node'
import {
	asArray,
	CLIENT_ONLY_PRIMITIVES,
	CONTEXT_NAMES,
	freeIdentifiers,
	identifierName,
	isNode,
} from './ast-utils'
import { type CompileDiagnostic, diagnostic } from './diagnostics'
import {
	containsImpureAmbient,
	foldableHostProps,
	foldableRefGuards,
	foldableRenderScope,
	hostDerivedFold,
	isServerEvaluable,
} from './evaluability'
import type { AttributeIR, ComponentIR, TemplateNode } from './ir'
import { childNodes } from './walk'

/* === The declared vocabulary === */

/** The reserved parameter that carries the page-ambient record (ADR 0030 s2). */
export const AMBIENT_RECORD_PARAM = 'i18n'

/**
 * The closed page-ambient set: the reserved `i18n` record's members (ADR
 * 0030 sub-design 2), each with the TypeScript type the generated `I18n`
 * interface gives it. `server/effects/i18n.ts` writes that interface from
 * this table, so the record type and the check cannot disagree about what
 * the record carries.
 */
export const PAGE_AMBIENT_TYPES: Readonly<Record<string, string>> = {
	lang: 'string',
	// The interface's type parameter: each server module instantiates it
	// with the component's exact per-key record (LT-308).
	t: 'T',
	timeZone: 'string',
	currency: 'string',
	dir: "'ltr' | 'rtl'",
}

/** The member names of {@link PAGE_AMBIENT_TYPES} — what the check reads. */
export const PAGE_AMBIENTS: ReadonlySet<string> = new Set(
	Object.keys(PAGE_AMBIENT_TYPES),
)

/**
 * Names the server harness binds into the render scope that are not args
 * or setup names. `isPending(signal)` reads the component's own signal, so
 * it is a function of the component's state, not a page input.
 */
export const FOLD_HARNESS_NAMES: ReadonlySet<string> = new Set(['isPending'])

/**
 * Globals whose value is page or build-machine context. A fold reading
 * one bakes the BUILD's answer into the served markup, and no template
 * hole can carry it to a backend. Deliberately separate from the
 * impure-ambient rule (`evaluability.ts`, LTC033): that rule is about
 * values with no server answer at all (the clock, the RNG); this one is
 * about inputs the invariant has not admitted.
 */
export const PAGE_CONTEXT_GLOBALS: ReadonlySet<string> = new Set([
	'document',
	'window',
	'globalThis',
	'self',
	'top',
	'parent',
	'frames',
	'opener',
	'navigator',
	'location',
	'history',
	'screen',
	'visualViewport',
	'localStorage',
	'sessionStorage',
	'indexedDB',
	'caches',
	'customElements',
	'performance',
])

/* === Exported Functions === */

/** Page-context globals `node` reads (scope-aware), sorted. */
export const pageContextReads = (node: AstNode): string[] =>
	[...freeIdentifiers(node)].filter(n => PAGE_CONTEXT_GLOBALS.has(n)).sort()

/**
 * LTC054 for the reserved record's destructuring: every member the params
 * pattern takes out of `i18n` must be in {@link PAGE_AMBIENTS}. A rest
 * element (`i18n: { ...rest }`) takes every member there is and is refused
 * too. Binding the whole record (`{ i18n }`) is allowed here; its member
 * reads are checked where they are evaluated (`checkFoldInputs`).
 */
export const ambientRecordViolations = (
	source: string,
	paramsNode: AstNode | null,
): CompileDiagnostic[] => {
	if (!paramsNode || paramsNode.type !== 'ObjectPattern') return []
	const out: CompileDiagnostic[] = []
	for (const prop of asArray(paramsNode.properties)) {
		if (prop.type !== 'Property') continue
		if (identifierName(prop.key) !== AMBIENT_RECORD_PARAM) continue
		let value = prop.value
		if (isNode(value) && value.type === 'AssignmentPattern') value = value.left
		if (!isNode(value) || value.type !== 'ObjectPattern') continue
		for (const inner of asArray(value.properties)) {
			if (inner.type === 'RestElement') {
				out.push(
					diagnostic.undeclaredPageAmbient(
						source,
						inner.start,
						null,
						PAGE_AMBIENTS,
					),
				)
				continue
			}
			if (inner.type !== 'Property') continue
			const member = inner.computed ? null : identifierName(inner.key)
			if (member === null || !PAGE_AMBIENTS.has(member))
				out.push(
					diagnostic.undeclaredPageAmbient(
						source,
						inner.start,
						member,
						PAGE_AMBIENTS,
					),
				)
		}
	}
	return out
}

/**
 * The compiler-side half of the invariant: the render scope holds only the
 * component's own args, its own setup names, and declared harness names. A
 * change that widens `serverKnown` with anything else (a page URL, a
 * request object) throws here in every corpus test rather than landing
 * silently. A thrown error, not a diagnostic: no authored source can cause
 * it.
 */
export const assertFoldScopeClosed = (component: ComponentIR): void => {
	const own = new Set<string>([
		...component.paramNames,
		...component.setup.flatMap(stmt => (stmt.name ? [stmt.name] : [])),
		...component.signals.map(signal => signal.name),
		...FOLD_HARNESS_NAMES,
	])
	const foreign = [...component.serverKnown].filter(name => !own.has(name))
	if (foreign.length > 0)
		throw new Error(
			`Partial-readiness invariant (ADR 0034 s4): <${component.tag}>'s render scope holds ${foreign.map(n => `\`${n}\``).join(', ')}, which is neither an own arg, an own setup name, nor a FOLD_HARNESS_NAMES member. Declare the input in server/compiler/fold-inputs.ts or keep it out of the fold.`,
		)
}

/**
 * LTC054 for every position the server render evaluates: a page-context
 * read there — directly, or through a setup helper whose body reads one —
 * is reported at the position. See the module doc for what is and is not
 * a fold input.
 */
export const checkFoldInputs = (
	component: ComponentIR,
	diagnostics: CompileDiagnostic[],
): void => {
	assertFoldScopeClosed(component)
	const { source } = component
	const refNames = new Set([
		...component.refReasons.keys(),
		...component.optionalRefs,
	])

	/**
	 * Setup statements the realm owns (routed by setup extraction), which
	 * the Folded-tier server module never evaluates for the fold.
	 */
	const realmOwned = (node: AstNode): boolean =>
		[...freeIdentifiers(node)].some(
			n =>
				CONTEXT_NAMES.has(n) ||
				CLIENT_ONLY_PRIMITIVES.has(n) ||
				refNames.has(n),
		)
	const isFunction = (node: AstNode): boolean =>
		/Function(Expression)?$/.test(String(node.type))

	// Setup helpers (function-valued consts) whose body reads page context,
	// directly or by calling another such helper — to a fixpoint. A helper is
	// never evaluated by its declaration, only by a fold that calls it, so
	// the report lands on the calling position.
	const tainted = new Map<string, string[]>()
	let changed = true
	while (changed) {
		changed = false
		for (const stmt of component.setup) {
			if (!stmt.name || tainted.has(stmt.name) || !isFunction(stmt.node))
				continue
			const reads = readsOf(stmt.node, tainted)
			if (reads.length === 0) continue
			tainted.set(stmt.name, reads)
			changed = true
		}
	}

	const report = (node: AstNode, where: string, reads: string[]): void => {
		diagnostics.push(
			diagnostic.foldReadsPageContext(
				source,
				node.start,
				where,
				reads,
				PAGE_AMBIENTS,
			),
		)
	}
	const checkEvaluated = (node: AstNode | null, where: string): void => {
		if (!node) return
		const reads = readsOf(node, tainted)
		if (reads.length > 0) report(node, where, reads)
	}

	// Setup: every non-function statement the server re-declares runs in the
	// render function, so its initializer is a fold input whether or not a
	// template position reads the name. `requestContext` is substituted by
	// its fallback server-side, so only the fallback is evaluated.
	for (const stmt of component.setup) {
		if (!stmt.name || isFunction(stmt.node)) continue
		const signal = component.signals.find(s => s.name === stmt.name)
		if (signal?.constructor === 'requestContext') {
			checkEvaluated(signal.init, `the \`${stmt.name}\` context fallback`)
			continue
		}
		if (realmOwned(stmt.node)) continue
		checkEvaluated(stmt.node, `setup const \`${stmt.name}\``)
	}

	const hostProps = foldableHostProps(component)
	const refGuards = foldableRefGuards(component)
	const renderScope = foldableRenderScope(component)
	/** Whether the server folds a reactive thunk (emit-server's three routes). */
	const folds = (thunk: AstNode, scope: ReadonlySet<string>): boolean =>
		isServerEvaluable(thunk, scope) ||
		hostDerivedFold(
			thunk,
			hostProps,
			refGuards,
			new Set([...renderScope, ...scope]),
		) !== null
	const checkReactive = (
		thunk: AstNode,
		scope: ReadonlySet<string>,
		where: string,
	): void => {
		const reads = readsOf(thunk, tainted)
		if (reads.length > 0 && folds(thunk, scope)) report(thunk, where, reads)
	}

	const checkAttr = (
		attr: AttributeIR,
		tag: string,
		scope: ReadonlySet<string>,
	): void => {
		switch (attr.kind) {
			case 'server':
				checkEvaluated(attr.node, `attribute \`${attr.name}\` on <${tag}>`)
				return
			case 'reactive':
				checkReactive(
					attr.thunk,
					scope,
					`attribute \`${attr.name}\` on <${tag}>`,
				)
				return
			case 'class-map':
			case 'style-map':
				checkReactive(
					attr.object,
					scope,
					`the \`${attr.kind === 'class-map' ? 'class' : 'style'}\` map on <${tag}>`,
				)
				return
			case 'html':
				checkReactive(attr.node, scope, `the HTML content of <${tag}>`)
				return
			case 'plural-case-type':
				checkEvaluated(attr.node, `\`truc:case-type\` on <${tag}>`)
				return
			default:
				return
		}
	}

	const visit = (node: TemplateNode, scope: ReadonlySet<string>): void => {
		let inner = scope
		switch (node.kind) {
			case 'element': {
				const loop = [...component.fors.values()].find(f => f.output === node)
				if (loop) {
					if (loop.kind === 'each') {
						checkEvaluated(loop.iterable, 'the items of a loop')
						// CHECKLIST §4 / LTC033 (error form), LT-326: the iterable
						// is always evaluated, once, at build time — a shuffle or a
						// random id bakes into the page for good. Checked here, not
						// in the front ends, because only this walk holds the
						// loop's OUTER scope, which a resolvable-locale `Intl`
						// needs to fold.
						if (containsImpureAmbient(loop.iterable, scope))
							diagnostics.push(
								diagnostic.impureLoopItems(source, loop.iterable.start),
							)
					}
					const loopScope = new Set(scope)
					loopScope.add(loop.itemName)
					if (loop.kind === 'each') {
						if (loop.indexName) loopScope.add(loop.indexName)
						for (const hoisted of loop.hoisted) {
							checkEvaluated(hoisted.node, `loop const \`${hoisted.name}\``)
							loopScope.add(hoisted.name)
						}
					}
					inner = loopScope
				}
				for (const attr of node.attrs) checkAttr(attr, node.tag, inner)
				break
			}
			case 'expr':
				if (node.lazy) checkReactive(node.expr, scope, 'a text child')
				else checkEvaluated(node.expr, 'a text child')
				break
			case 'if':
				checkEvaluated(node.test, 'a condition')
				break
			case 'switch':
				checkEvaluated(node.discriminant, 'a switch discriminant')
				for (const arm of node.cases)
					if (arm.test) checkEvaluated(arm.test, 'a switch case')
				break
			case 'compose':
				for (const attr of node.attrs)
					if (attr.kind === 'arg')
						checkEvaluated(
							attr.node,
							`arg \`${attr.name}\` of <${node.component}>`,
						)
				break
			case 'try':
				if (node.catchParam) {
					const catchScope = new Set(scope)
					catchScope.add(node.catchParam)
					for (const child of node.children) visit(child, scope)
					for (const child of node.catchChildren) visit(child, catchScope)
					for (const child of node.pendingChildren ?? []) visit(child, scope)
					return
				}
				break
			default:
				break
		}
		for (const child of childNodes(node)) visit(child, inner)
	}
	visit(component.root, component.serverKnown)
	for (const loop of component.fors.values())
		for (const node of loop.emptyArm ?? []) visit(node, component.serverKnown)
}

/* === Internal Functions === */

/**
 * The page context `node` reaches: its own page-context global reads plus,
 * for each tainted helper it references, that helper's reads.
 */
const readsOf = (
	node: AstNode,
	tainted: ReadonlyMap<string, string[]>,
): string[] => {
	const reads = new Set([...pageContextReads(node), ...recordMemberReads(node)])
	for (const name of freeIdentifiers(node))
		for (const read of tainted.get(name) ?? []) reads.add(read)
	return [...reads].sort()
}

/**
 * Reads off a whole-bound ambient record (`{ i18n }` → `i18n.url`) that
 * name a member outside {@link PAGE_AMBIENTS}, or compute one. The
 * destructured spelling is checked at the params pattern instead
 * (`ambientRecordViolations`); this covers the whole-record binding, whose
 * `I18n` type would make tsc refuse the read — but the build does not
 * necessarily run tsc. Unaware of shadowing: a local named `i18n` is
 * checked the same way, which errs toward reporting.
 */
const recordMemberReads = (node: AstNode): string[] => {
	const out: string[] = []
	const visit = (current: unknown): void => {
		if (Array.isArray(current)) {
			for (const child of current) visit(child)
			return
		}
		if (!isNode(current)) return
		if (
			current.type === 'MemberExpression' &&
			isNode(current.object) &&
			current.object.type === 'Identifier' &&
			String(current.object.name) === AMBIENT_RECORD_PARAM
		) {
			const member = current.computed ? null : identifierName(current.property)
			if (member === null) out.push(`${AMBIENT_RECORD_PARAM}[…]`)
			else if (!PAGE_AMBIENTS.has(member))
				out.push(`${AMBIENT_RECORD_PARAM}.${member}`)
		}
		for (const [key, value] of Object.entries(current)) {
			if (key === 'loc' || key === 'range' || key === 'parent') continue
			if (value && typeof value === 'object') visit(value)
		}
	}
	visit(node)
	return out
}
