/**
 * The single home of the server-known evaluability rule (LT-043,
 * regrouping move M4 of LE_TRUC_COMPILER.md §7): the predicate deciding
 * WHAT THE SERVER RENDERS. A reactive expression renders its initial value
 * server-side only when every name it reads — minus JS/DOM globals — is in
 * the render scope (args + setup consts + signals); otherwise it is omitted
 * and the client's first binding pass corrects it (DOM-is-truth, ADR
 * 0003/0024 s3). Before LT-043 this rule was restated in `analyze.ts`,
 * `emit-server.ts`, and `plain-imports.ts` — a divergence between the
 * copies would be a wrong COMPONENT, not a wrong error message; the server
 * goldens pin the render set byte-for-byte.
 */

import type { AstNode } from './ast-node'
import {
	collectBoundNames,
	freeIdentifiers,
	isNode,
	JS_GLOBALS,
} from './ast-utils'
import { refBranchGuard } from './first-refs'
import type { ComponentIR, TemplateNode } from './ir'

/**
 * Ambient globals whose *inputs* are the build machine's own state (wall
 * clock, RNG), not any server arg or signal — a "free identifiers ⊆ scope"
 * check alone can't see this, since `Date`/`Math` are themselves in
 * {@link JS_GLOBALS} and read no server-known name at all. Folding one of
 * these bakes the BUILD MACHINE's reading into the page permanently
 * (CHECKLIST §4). `Date.now()`/`new Date()` are not deterministic at all —
 * there is no argument that could make them server-known — so `Date` is
 * impure at the root, with ONE exception (`Date.UTC`, below): the local
 * constructor and the zone-less formatter read the build machine's
 * TIMEZONE, while `Date.UTC(y, m - 1, d)` is a pure function of its
 * arguments (LT-165 step 5's analysis; ADR 0030 s2 resolved the shape this
 * way — pair it with a `timeZone: 'UTC'` formatter, which `Intl`'s own
 * locale rule already admits). `Intl` is handled separately below (LT-142).
 */
const IMPURE_AMBIENT_ROOTS: ReadonlySet<string> = new Set(['Date'])

/**
 * `Intl.PluralRules`/`Intl.NumberFormat`/`Intl.DateTimeFormat` etc. are
 * deterministic GIVEN A LOCALE — unlike `Date`, they read the build
 * machine's own state only when the locale argument is itself unresolved
 * (the runtime default). LT-142 (owner decision 2026-09-02): fold an
 * `Intl.<Ctor>(locale, ...)` call/construction when `locale` resolves to a
 * server-known value — a string literal, or an identifier already in
 * `scope` (a server arg or a server-known const). Any other shape (a
 * missing locale, a `host.<prop>` read, a computed member, another call)
 * is left impure — conservative, not "guess and hope". Where the folded
 * value and the client's eventual value disagree (the page's actual `lang`
 * differs from the folded arg), the client thunk re-runs at connect and
 * corrects — the same precedent ADR 0024 sub-design 15 set for
 * `requestContext` fallbacks, and sub-design 3's documented flash tradeoff.
 */
const isLocaleResolvable = (
	arg: unknown,
	scope: ReadonlySet<string>,
): boolean => {
	if (!isNode(arg)) return false
	if (arg.type === 'Literal' && typeof arg.value === 'string') return true
	if (arg.type === 'Identifier') return scope.has(String(arg.name))
	return false
}

/**
 * The random-number sources, by receiver (LT-314): `Math.random()` and the
 * Web Crypto generators on `crypto`. Each call reads the RNG, which has no
 * server answer, so a fold would bake one build-time value into the page.
 * The rest of `Math` stays pure (`Math.max`/`Math.min`/etc. are functions
 * of their arguments).
 */
const RNG_METHODS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
	['Math', new Set(['random'])],
	['crypto', new Set(['randomUUID', 'getRandomValues'])],
])

/** Method names whose ambient inputs (not their receiver) make them impure. */
const IMPURE_AMBIENT_METHODS: ReadonlySet<string> = new Set([
	'toLocaleString',
	'toLocaleDateString',
	'toLocaleTimeString',
	'getTimezoneOffset',
])

/**
 * Whether `node` contains a call/read against an impure ambient (CHECKLIST
 * §4): `Date` (and its members — `Date.now()`, `new Date()`; `Date.UTC(...)`
 * excepted — a pure function of its arguments), the RNG calls in
 * `RNG_METHODS` (`Math.random()`, `crypto.randomUUID()`,
 * `crypto.getRandomValues()` — not `Math` at large), the locale/timezone-reading
 * instance methods (`x.toLocaleString()`, `x.getTimezoneOffset()`) regardless
 * of receiver, since the ambient input is in the method, not the object it's
 * called on, and `Intl.<Ctor>(...)` calls/constructions whose locale argument
 * does NOT resolve within `scope` (LT-142) — a resolvable-locale `Intl` call
 * is deterministic and folds; every other `Intl` read (bare, computed member,
 * unresolvable locale) stays impure.
 */
export const containsImpureAmbient = (
	node: AstNode,
	scope: ReadonlySet<string> = new Set(),
): boolean => impureAmbientCauses(node, scope).length > 0

/**
 * Why `node` is impure, rather than merely whether it is — the same walk as
 * {@link containsImpureAmbient}, which is defined in terms of this one so
 * the two cannot drift.
 *
 * The distinction exists for the tier classifier (ADR 0029 sub-design 5,
 * LT-165). Impurity means "phase 1 must not fold this", which is one
 * question; "can any server phase answer it" is a different one, and
 * LT-142's `Intl` rule splits three ways along exactly this seam:
 *
 * - `intl-server-locale` never appears here — a resolvable locale is not
 *   impure at all, and the call folds.
 * - `intl-dom-locale` is impure for FOLDING (the value harness has no DOM
 *   to read the locale from) but the REALM can answer it, because it
 *   executes `getLocale(el)` against a real simulated element. A
 *   Simulated-tier routing signal, not an unresolvable expression.
 * - `intl-default-locale` is unresolvable: the default is the build
 *   machine's own setting, and no driver capability can change that.
 *
 * `date`, `rng` and `locale-method` are unresolvable in every tier for the
 * same reason — their input is the viewing moment or the build machine.
 */
export type ImpureAmbientCause =
	| 'date'
	| 'rng'
	| 'locale-method'
	| 'intl-default-locale'
	| 'intl-dom-locale'

export const impureAmbientCauses = (
	node: AstNode,
	scope: ReadonlySet<string> = new Set(),
): ImpureAmbientCause[] => {
	const causes: ImpureAmbientCause[] = []
	let found = false
	const flag = (cause: ImpureAmbientCause) => {
		causes.push(cause)
		found = true
	}
	const visit = (current: unknown): void => {
		if (found) return
		if (Array.isArray(current)) {
			for (const child of current) visit(child)
			return
		}
		if (!isNode(current)) return
		if (current.type === 'Identifier') {
			const name = String(current.name)
			// A bare `Intl` read reached without matching the call shape below
			// (a computed member, an aliasing assignment) — conservative, and
			// unresolvable rather than realm-answerable, since nothing here
			// proves a locale ever reaches it.
			if (name === 'Intl') {
				flag('intl-default-locale')
				return
			}
			if (IMPURE_AMBIENT_ROOTS.has(name)) {
				flag('date')
				return
			}
		}
		if (
			(current.type === 'CallExpression' ||
				current.type === 'OptionalCallExpression' ||
				current.type === 'NewExpression') &&
			isNode(current.callee) &&
			current.callee.type === 'MemberExpression' &&
			!current.callee.computed
		) {
			const obj = current.callee.object
			const prop = current.callee.property
			if (
				isNode(obj) &&
				obj.type === 'Identifier' &&
				String(obj.name) === 'Date' &&
				isNode(prop) &&
				prop.type === 'Identifier' &&
				String(prop.name) === 'UTC'
			) {
				// The one pure `Date` form: `Date.UTC(...)` converts fixed
				// arguments to a timestamp with no clock and no timezone read,
				// so it folds (LT-165 step 5). Still walk the arguments — a
				// nested `Date.now()` inside them stays flagged — but skip the
				// callee, whose `Date` identifier would otherwise trip the
				// generic root check. The LOCAL constructor (`new Date(y, m,
				// d)`) gets no such admission: it interprets its arguments in
				// the build machine's timezone, which is limb (b) ambient state
				// even though it reads no viewing-moment fact (the day must not
				// depend on where the build ran — ADR 0030 s2 prescribes the
				// `Date.UTC` + `timeZone: 'UTC'` shape instead).
				const utcArgs = Array.isArray(current.arguments)
					? current.arguments
					: []
				for (const arg of utcArgs) visit(arg)
				return
			}
			if (
				isNode(obj) &&
				obj.type === 'Identifier' &&
				isNode(prop) &&
				prop.type === 'Identifier' &&
				RNG_METHODS.get(String(obj.name))?.has(String(prop.name))
			) {
				flag('rng')
				return
			}
			if (
				isNode(prop) &&
				prop.type === 'Identifier' &&
				IMPURE_AMBIENT_METHODS.has(String(prop.name))
			) {
				flag('locale-method')
				return
			}
			if (
				isNode(obj) &&
				obj.type === 'Identifier' &&
				String(obj.name) === 'Intl'
			) {
				const args = Array.isArray(current.arguments) ? current.arguments : []
				if (!isLocaleResolvable(args[0], scope)) {
					// Absent locale → the runtime default, the build machine's own
					// setting, unresolvable. Present but not server-known → a DOM
					// read the realm can execute for real (LT-142's middle case).
					flag(
						args[0] === undefined ? 'intl-default-locale' : 'intl-dom-locale',
					)
					return
				}
				// Locale resolved: still walk the remaining arguments (e.g. an
				// `options` object) for any nested impure ambient, but skip the
				// `Intl` identifier itself so it isn't flagged by the generic
				// root check below.
				for (const arg of args) visit(arg)
				return
			}
		}
		for (const [key, value] of Object.entries(current)) {
			if (key === 'loc' || key === 'range' || key === 'parent') continue
			if (value && typeof value === 'object') visit(value)
		}
	}
	visit(node)
	return causes
}

/**
 * Free identifiers excluding JS globals — the dependency set that matters
 * for evaluability. Note the analyzer additionally consults this set for
 * its CLIENT-portability checks (a thunk the factory can resolve) — same
 * helper, different scope vocabulary.
 */
export const dependenciesOf = (node: AstNode): Set<string> => {
	const free = freeIdentifiers(node)
	for (const global of JS_GLOBALS) free.delete(global)
	return free
}

/**
 * Whether `node` can be evaluated server-side under `scope`: every
 * non-global free name it reads is server-known. The one gate behind
 * reactive-attribute rendering, class/style maps, `html`, lazy children
 * (emit-server), server-rendered-thunk import placement (plain-imports),
 * and the root's initial class/style (LT-028/LT-032 exemptions).
 */
export const isServerEvaluable = (
	node: AstNode,
	scope: ReadonlySet<string>,
): boolean =>
	dependenciesOf(node).isSubsetOf(scope) && !containsImpureAmbient(node, scope)

/**
 * Every prop bound at an owned site from a same-named server arg
 * (LT-122's `bindsProp`), anywhere in the template — a text child
 * (`<span class="zero">{zero}</span>`) or an attribute. Collected
 * for {@link foldableHostProps}; see the rationale there.
 */
const argRenderedProps = (node: TemplateNode): string[] => {
	if (node.kind === 'if')
		return [...node.then, ...node.alternate].flatMap(argRenderedProps)
	if (node.kind === 'switch')
		return node.cases.flatMap(arm => arm.children.flatMap(argRenderedProps))
	if (node.kind === 'try')
		return [...node.children, ...node.catchChildren].flatMap(argRenderedProps)
	if (node.kind === 'expr') return node.bindsProp ? [node.bindsProp] : []
	if (node.kind !== 'element') return []
	const own = node.attrs.flatMap(attr =>
		attr.kind === 'server' && attr.bindsProp ? [attr.bindsProp] : [],
	)
	return [...own, ...node.children.flatMap(argRenderedProps)]
}

/**
 * Every `first()`-bound ref whose presence the server can settle, mapped
 * to the condition that settles it (LT-118) — the ref half of
 * {@link hostDerivedFold}'s substitutable set. See `refBranchGuard`
 * (first-refs.ts) for what each condition means and when a ref is left
 * out (a `@switch`/`@try` arm, or several matches).
 */
export const foldableRefGuards = (
	component: ComponentIR,
): ReadonlyMap<string, string> => {
	const guards = new Map<string, string>()
	const declared = new Set([
		...component.refReasons.keys(),
		...component.optionalRefs,
	])
	for (const name of declared) {
		const guard = refBranchGuard(component.root, name)
		if (guard !== null) guards.set(name, guard)
	}
	return guards
}

/**
 * Global config attributes the PLATFORM itself reflects (LT-191): `lang`
 * and `dir` are built-in IDL properties whose accessors read the attribute
 * verbatim, so a `host.<name>` read mirrors the root attribute's server
 * expression WITHOUT Parser exposure — there is no parser owning the
 * attribute→value semantics because the platform owns them. A component
 * that treats `lang` as config-only (the ADR 0030 posture: the locale
 * materializes onto the attribute, never a reactive prop) keeps its fold
 * through this route.
 */
const PLATFORM_CONFIG_ATTRS: ReadonlySet<string> = new Set(['lang', 'dir'])

/**
 * Host props whose SERVER-SIDE truth the compiler knows — the
 * substitutable set for {@link hostDerivedFold} (CHECKLIST §5, LT-085).
 * Three ways a prop earns membership, and they are the same fact reached
 * from opposite directions:
 *
 * 1. **Parser-exposed with a server-rendered root attribute** — the host
 *    attribute is the prop's seed (ADR 0003), so the root attribute's own
 *    `exprText` IS the value. This is what `emit-server.ts`'s bare-mirror
 *    case (`hostPropOf`, ast-utils.ts) already relies on.
 * 2. **Harvested from a site a same-named server arg renders** (LT-118,
 *    the server half of LT-122's coincidence) — the arg renders the site,
 *    the site seeds the prop at connect, so the ARG is the value. The
 *    substituted expression is the arg name itself, in scope in the
 *    generated render function.
 * 3. **A platform config attribute rendered onto the root** (LT-191) —
 *    `lang`/`dir` are not reactive properties at all (the native accessor
 *    shadows any expose() accessor, `prop in this`), and the native
 *    accessor reads the attribute verbatim, so the root attribute's
 *    `exprText` is the value exactly as in (1), no parser required.
 *
 * Without (2), following the data account costs you the fold: a component
 * that harvests `zero` from its own `.zero` span instead of duplicating it
 * onto a host attribute would see every `hidden={() => …host.zero…}` thunk
 * drop out of the initial HTML (LTC034) — the pre-JS flash this fold
 * exists to prevent, charged as a penalty for doing the right thing.
 */
export const foldableHostProps = (
	component: ComponentIR,
): ReadonlySet<string> => {
	const names = new Set<string>()
	for (const attr of component.root.attrs)
		if (
			attr.kind === 'server' &&
			(component.parserExposeProps.has(attr.name) ||
				PLATFORM_CONFIG_ATTRS.has(attr.name))
		)
			names.add(attr.name)
	for (const prop of argRenderedProps(component.root)) names.add(prop)
	return names
}

/**
 * One read replaced during {@link hostDerivedFold} — either a
 * `host.<prop>` member (`kind: 'prop'`) or a bare identifier naming a
 * `first()`-bound ref whose presence the server decides (`kind: 'ref'`,
 * LT-118).
 */
export type HostPropRead = {
	start: number
	end: number
	prop: string
	kind: 'prop' | 'ref'
}

/**
 * Whether `node` reads ONLY `host.<prop>` members (each `prop` in
 * `foldable`) combined via pure JS operators — no bare/computed `host`
 * escape, no other free non-global name, no impure ambient. Widens the
 * server-fold rule beyond the bare `() => host.<prop>` mirror (`hostPropOf`,
 * ast-utils.ts) to derived reads like `() => host.value <= host.min` or
 * `() => !host.editing` (CHECKLIST §5, LT-085) — `emit-server.ts` splices
 * each returned range in place with the corresponding root attribute's
 * server expression to fold the whole thunk to an initial value; LTC034
 * (`analysis/effects.ts`) treats a non-null result the same as a bare
 * mirror when deciding whether omission is safe.
 *
 * `foldableRefs` (LT-118) extends the same idea to a `first()`-bound ref
 * read as a bare identifier: the hand-written idiom for an optional
 * affordance is `const zero = first('.zero'); if (zero) { … }`, a LOCAL
 * ref and not a reactive prop, and a compiled component must be able to
 * say it too. Client-side a ref is simply in scope; server-side its
 * presence is whatever `refBranchGuard` (first-refs.ts) computed for it.
 *
 * `allow` (LT-173 step 6) widens the third refusal — "reads some other
 * free name" — to names that RESOLVE IN THE RENDER FUNCTION'S SCOPE:
 * server args, signals (`.get()` is the harness's initial value), and the
 * transitive-pure setup consts `foldableRenderScope` admits. The spliced
 * thunk is IIFE-invoked inside the generated render function, so a call to
 * a setup const (`formatCount(host.lang, host.count)`)
 * evaluates there exactly as the author wrote it; the same set doubles as
 * the impure-ambient WALK's scope, so an `Intl` constructor whose locale
 * is a server-known name (or a such-scoped call's parameter) counts as
 * locale-resolvable (LT-142's rule, applied transitively). Undefined
 * restores the pre-LT-173 behavior (no allowances, empty impurity scope).
 *
 * All-or-nothing: one `host` read that isn't a member of `foldable` (a
 * signal-shaped prop the root doesn't render, a computed member, `host`
 * itself escaping as a bare value), or one free name that is neither
 * foldable, nor a foldable ref, nor in `allow`, disqualifies the WHOLE
 * expression — substituting only some of several reads would fold a
 * plausible-looking but wrong initial value, worse than omitting the
 * attribute entirely and letting the client's first pass render it.
 */
export const hostDerivedFold = (
	node: AstNode,
	foldable: ReadonlySet<string>,
	foldableRefs: ReadonlyMap<string, string> = new Map(),
	allow?: ReadonlySet<string>,
): readonly HostPropRead[] | null => {
	if (containsImpureAmbient(node, allow ?? new Set())) return null
	const reads: HostPropRead[] = []
	let escaped = false
	const visit = (current: unknown, bound: ReadonlySet<string>): void => {
		if (escaped || Array.isArray(current)) {
			if (Array.isArray(current)) for (const c of current) visit(c, bound)
			return
		}
		if (!isNode(current)) return
		switch (current.type) {
			case 'Identifier': {
				const name = String(current.name)
				if (bound.has(name)) return
				if (name === 'host') {
					escaped = true
					return
				}
				if (foldableRefs.has(name))
					reads.push({
						start: typeof current.start === 'number' ? current.start : 0,
						end: typeof current.end === 'number' ? current.end : 0,
						prop: name,
						kind: 'ref',
					})
				return
			}
			case 'MemberExpression': {
				const obj = current.object
				if (
					!current.computed &&
					isNode(obj) &&
					obj.type === 'Identifier' &&
					String(obj.name) === 'host' &&
					!bound.has('host')
				) {
					const prop = current.property
					const name =
						isNode(prop) && prop.type === 'Identifier'
							? String(prop.name)
							: null
					if (name === null || !foldable.has(name)) {
						escaped = true
						return
					}
					reads.push({
						start: typeof current.start === 'number' ? current.start : 0,
						end: typeof current.end === 'number' ? current.end : 0,
						prop: name,
						kind: 'prop',
					})
					return
				}
				// A ref read as a MEMBER (`zeroSpan.textContent`) is not a
				// presence read: its guard condition is a boolean, and
				// splicing that in would give the server `(zero).textContent`.
				// The server may well know the answer — the span's text is the
				// arg that renders it — but proving that is the harvest-site
				// relation, not this fold. Refuse rather than guess.
				if (
					isNode(obj) &&
					obj.type === 'Identifier' &&
					!bound.has(String(obj.name)) &&
					foldableRefs.has(String(obj.name))
				) {
					escaped = true
					return
				}
				visit(obj, bound)
				if (current.computed) visit(current.property, bound)
				return
			}
			case 'Property':
				if (current.computed) visit(current.key, bound)
				visit(current.value, bound)
				return
			case 'ArrowFunctionExpression':
			case 'FunctionExpression': {
				const inner = new Set(bound)
				for (const param of Array.isArray(current.params) ? current.params : [])
					if (isNode(param) && param.type === 'Identifier')
						inner.add(String(param.name))
				visit(current.body, inner)
				return
			}
			default:
				for (const [key, value] of Object.entries(current)) {
					if (key === 'loc' || key === 'range' || key === 'parent') continue
					if (key === 'type' || key === 'start' || key === 'end') continue
					visit(value, bound)
				}
		}
	}
	visit(node, new Set())
	if (escaped) return null
	const others = dependenciesOf(node)
	others.delete('host')
	for (const ref of foldableRefs.keys()) others.delete(ref)
	if (allow) for (const name of allow) others.delete(name)
	if (others.size > 0) return null
	return reads
}

/**
 * The names a host-derived fold may leave IN the spliced thunk for the
 * render function's scope to resolve (LT-173 step 6): the component's
 * `serverKnown`, with every setup const replaced by the subset that is
 * TRANSITIVELY PURE — its initializer contains no impure ambient (checked
 * against `serverKnown` widened by the initializer's own bound parameters,
 * so an `Intl` constructor whose locale is a helper parameter counts as
 * resolvable — the value arrives from the spliced call sites) and every
 * setup const it references is admitted too, to a fixpoint. A rejected
 * const stays rejected, and so does every thunk that calls it: an impure
 * body would only run AT fold time (the declaration doesn't execute it),
 * which is exactly what the fold must not do.
 *
 * Signals keep their `serverKnown` membership: under the value harness a
 * signal IS its initial value (`.get()` reads once, `.set()` is a no-op),
 * so a `.get()` inside a spliced thunk renders the declared initial — the
 * same exposure the plain `isServerEvaluable` path already has.
 *
 * Consumers: `hostDerivedFold`'s `allow` in `analysis/effects.ts` (the
 * LTC034 routing check — it must agree with what the emitter folds) and
 * `emit-server.ts` (the fold itself). One implementation for both, or the
 * two drift.
 */
export const foldableRenderScope = (
	component: ComponentIR,
): ReadonlySet<string> => {
	/** Plain setup consts, by declared name (signals excluded). */
	const constInits = new Map<string, AstNode>()
	for (const stmt of component.setup) {
		if (stmt.name === null) continue
		if (component.signals.some(signal => signal.name === stmt.name)) continue
		constInits.set(stmt.name, stmt.node)
	}
	const scope = new Set<string>(
		[...component.serverKnown].filter(name => !constInits.has(name)),
	)
	/** Names bound by function parameters / catch clauses within `node`. */
	const boundWithin = (node: unknown, into: Set<string>): void => {
		if (Array.isArray(node)) {
			for (const child of node) boundWithin(child, into)
			return
		}
		if (!isNode(node)) return
		if (
			node.type === 'ArrowFunctionExpression' ||
			node.type === 'FunctionExpression' ||
			node.type === 'FunctionDeclaration'
		) {
			for (const param of Array.isArray(node.params) ? node.params : [])
				collectBoundNames(param, into)
		}
		if (node.type === 'CatchClause' && isNode(node.param))
			collectBoundNames(node.param, into)
		for (const [key, value] of Object.entries(node)) {
			if (
				key === 'loc' ||
				key === 'range' ||
				key === 'parent' ||
				key === 'type' ||
				key === 'start' ||
				key === 'end'
			)
				continue
			if (value && typeof value === 'object') boundWithin(value, into)
		}
	}
	let changed = true
	while (changed) {
		changed = false
		for (const [name, init] of constInits) {
			if (scope.has(name)) continue
			const params = new Set<string>()
			boundWithin(init, params)
			const checkScope = new Set([...component.serverKnown, ...params])
			if (impureAmbientCauses(init, checkScope).length > 0) continue
			let callsRejected = false
			for (const free of dependenciesOf(init))
				if (constInits.has(free) && !scope.has(free)) callsRejected = true
			if (callsRejected) continue
			scope.add(name)
			changed = true
		}
	}
	return scope
}

/**
 * The server expression for a host-derived fold (LT-085): `thunkText`
 * (`() => host.value <= host.min`) with each `reads` range spliced for the
 * corresponding root attribute's `exprText` (`() => (value) <= (min)`),
 * ready to IIFE-invoke the same way the plain-`isServerEvaluable` case does
 * (`emit-server.ts`). `thunkStart` is the thunk node's own source offset —
 * `reads` ranges are absolute source offsets, `thunkText` is relative.
 */
export const spliceHostDerivedFold = (
	thunkText: string,
	thunkStart: number,
	reads: readonly HostPropRead[],
	exprTextOf: (prop: string, kind: 'prop' | 'ref') => string,
): string => {
	let out = ''
	let cursor = 0
	for (const r of [...reads].sort((a, b) => a.start - b.start)) {
		out += thunkText.slice(cursor, r.start - thunkStart)
		out += `(${exprTextOf(r.prop, r.kind)})`
		cursor = r.end - thunkStart
	}
	out += thunkText.slice(cursor)
	return out
}
