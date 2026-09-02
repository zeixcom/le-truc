/**
 * The single home of the reactive-lift rule (LT-051): the predicate deciding
 * WHETHER A TEMPLATE CHILD IS REACTIVE. Sibling of `evaluability.ts`, which
 * decides what the SERVER renders — the two questions are independent (a
 * reactive child may still have a server-known initial value, and a static
 * child may not).
 *
 * The line is *lexically visible reactive read* vs. *read behind an opaque
 * call boundary*, not *single read* vs. *compound expression*:
 *
 *   {host.validationMessage}              → reactive (visible host read)
 *   {length.get() === 0}                  → reactive (visible .get())
 *   {description.replace('{n}', …get())}  → reactive (visible .get())
 *   {label}                               → static   (a server arg)
 *   {formatRemaining(maxlength, length)}  → OPAQUE   (signal crosses a call)
 *
 * The opaque case is an error rather than a silent static emit because a
 * missed lift is invisible: the server folds it, the HTML is correct, the
 * demo looks right, and it never updates. Over-lift is loud; under-lift
 * survives review and screenshots. An explicit `{() => …}` thunk is always
 * legal and is never inspected — it is the sanctioned override wherever
 * tracing fails.
 */

import type { TsrxNode } from '@tsrx/core'
import { isNode, nodeType } from './ast-utils'

/**
 * The client-only ambient whose property reads are reactive by definition.
 * `host.<prop>` resolves against the component's own exposed props, so a
 * lexical `host.x` is a signal read in every position it can appear.
 */
const REACTIVE_AMBIENT = 'host'

/**
 * A name lookup satisfied by both `Set<string>` and `Map<string, …>` — the
 * caller holds a `Map<string, SignalIR>` and there is no reason to allocate
 * a set per child just to ask `.has()`.
 */
type NameSet = { has(name: string): boolean }

/** Verdict for one template-child expression. */
export type LiftVerdict =
	/** No reactive read anywhere — server-render it once, emit no watch. */
	| { kind: 'static' }
	/** A lexically visible reactive read — lift it into a `watch()`. */
	| { kind: 'reactive' }
	/**
	 * A signal reference escapes into a call the compiler cannot see inside.
	 * `names` are the escaping signals, for the diagnostic's fix-it.
	 */
	| { kind: 'opaque'; names: string[] }

/**
 * Does this template expression name a server arg that is ALSO an
 * exposed prop (LT-122)? Returns the shared name, or `null`.
 *
 * That coincidence is the children-are-data contract written out: the
 * component receives `label` as a server arg, renders it into its own
 * markup, and exposes a `label` prop the client seeds by HARVESTING
 * that same markup back (TSRX-HOST-PROFILE § data account bullet 4).
 * The site is therefore three things at once, and each spelling on its
 * own only covers part of it — `{label}` renders but never rebinds,
 * `{host.label}` rebinds but renders empty, which is what pushed
 * LT-092 into duplicating the value onto a host attribute.
 *
 * A declared SIGNAL of the same name is excluded: a signal already
 * owns a render site and a harvest plan (`analysis/harvest.ts`), and
 * would bind itself twice if this rule also claimed it.
 *
 * A PARSER-exposed prop is excluded too, and for a sharper reason:
 * it already has a seeding channel — the host attribute — so the
 * site is a second copy of the value rather than its home. Binding
 * it would make that worse, not better: `<textarea …>{value}</textarea>`
 * (form-textbox) is a native control's INITIAL content, and a
 * live `bindText` over it would fight the dirty-value flag the
 * moment the user typed. Those shapes get TSRX039 instead, which
 * names the two channels and asks the author to pick one.
 */
/**
 * The TSRX039 shape (LT-122): a site rendering a server arg whose
 * name is a PARSER-exposed prop — the value's real seeding channel
 * is the host attribute, so this site is a second copy of it.
 * Returns the shared name, or `null`.
 *
 * Deliberately independent of `bindsExposedArg`, which excludes
 * exactly this case: the compiler declines to bind such a site AND
 * says why, rather than doing neither or both.
 */
export const duplicatedChannelArg = (
	expr: TsrxNode,
	args: NameSet,
	parserProps: NameSet,
): string | null => {
	if (nodeType(expr) !== 'Identifier') return null
	const name = String(expr.name)
	return args.has(name) && parserProps.has(name) ? name : null
}

export const bindsExposedArg = (
	expr: TsrxNode,
	args: NameSet,
	exposedProps: NameSet,
	signals: NameSet,
	parserProps: NameSet,
): string | null => {
	if (nodeType(expr) !== 'Identifier') return null
	const name = String(expr.name)
	return args.has(name) &&
		exposedProps.has(name) &&
		!signals.has(name) &&
		!parserProps.has(name)
		? name
		: null
}

/**
 * Classify a template-child expression against the component's signal names.
 *
 * `signals` is the declared-signal name set; `host` is always reactive. Server
 * args and plain setup consts are neither, so they classify `static` — which
 * is why adding this rule left the existing corpus byte-identical.
 */
export const classifyChild = (
	expr: TsrxNode,
	signals: NameSet,
): LiftVerdict => {
	// An authored thunk is the explicit override: always reactive, never
	// inspected. Nothing inside it can be "missed", so nothing inside it can
	// be an error.
	if (nodeType(expr) === 'ArrowFunctionExpression') return { kind: 'reactive' }

	// A bare signal identifier is the identifier-source `watch()` overload
	// (`watch(count, …)`) — a read, not an escape.
	if (nodeType(expr) === 'Identifier' && signals.has(String(expr.name)))
		return { kind: 'reactive' }

	let reads = 0
	const escapes = new Set<string>()

	const visit = (current: unknown, bound: ReadonlySet<string>): void => {
		if (Array.isArray(current)) {
			for (const child of current) visit(child, bound)
			return
		}
		if (!isNode(current)) return
		switch (current.type) {
			case 'Identifier': {
				const name = String(current.name)
				// Reached as a value, not as the object of a member read (that
				// case is consumed below): the signal itself crosses into
				// whatever expression encloses it.
				if (
					!bound.has(name) &&
					(signals.has(name) || name === REACTIVE_AMBIENT)
				)
					escapes.add(name)
				return
			}
			case 'MemberExpression': {
				const obj = current.object
				const objName =
					isNode(obj) && obj.type === 'Identifier' ? String(obj.name) : null
				// `sig.get()`, `sig.get`, `host.validationMessage` — the read
				// forms. The object is consumed here, so it never reaches the
				// Identifier case and never counts as an escape.
				if (
					objName !== null &&
					!bound.has(objName) &&
					(signals.has(objName) || objName === REACTIVE_AMBIENT)
				) {
					reads++
					if (current.computed) visit(current.property, bound)
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
				// A nested thunk's body is still lexically visible here, so its
				// reads count — `{items.filter(i => i.id === sel.get())}` lifts.
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
				return
		}
	}

	visit(expr, new Set<string>())

	if (escapes.size > 0) return { kind: 'opaque', names: [...escapes].sort() }
	return reads > 0 ? { kind: 'reactive' } : { kind: 'static' }
}
