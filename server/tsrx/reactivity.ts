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
