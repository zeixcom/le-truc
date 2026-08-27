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

import type { TsrxNode } from '@tsrx/core'
import { freeIdentifiers, isNode, JS_GLOBALS } from './ast-utils'

/**
 * Ambient globals whose *inputs* are the build machine's own state (locale,
 * timezone, wall clock, RNG), not any server arg or signal — a "free
 * identifiers ⊆ scope" check alone can't see this, since `Date`/`Math`/
 * `Intl` are themselves in {@link JS_GLOBALS} and read no server-known name
 * at all. Folding one of these bakes the BUILD MACHINE's reading into the
 * page permanently (CHECKLIST §4): for SSG specifically, add the build-to-
 * serve time gap on top — a locale-formatted date folded at build time is
 * stale by however long the page sits before being served.
 */
const IMPURE_AMBIENT_ROOTS: ReadonlySet<string> = new Set(['Date', 'Intl'])

/** Method names whose ambient inputs (not their receiver) make them impure. */
const IMPURE_AMBIENT_METHODS: ReadonlySet<string> = new Set([
	'toLocaleString',
	'toLocaleDateString',
	'toLocaleTimeString',
	'getTimezoneOffset',
])

/**
 * Whether `node` contains a call/read against an impure ambient (CHECKLIST
 * §4): `Date`/`Intl` (and their members — `Date.now()`, `new Date()`,
 * `Intl.DateTimeFormat(...)`), `Math.random()` specifically (not `Math` at
 * large — `Math.max`/`Math.min`/etc. are pure functions of their arguments,
 * safe to fold), and the locale/timezone-reading instance methods
 * (`x.toLocaleString()`, `x.getTimezoneOffset()`) regardless of receiver,
 * since the ambient input is in the method, not the object it's called on.
 */
export const containsImpureAmbient = (node: TsrxNode): boolean => {
	let found = false
	const visit = (current: unknown): void => {
		if (found) return
		if (Array.isArray(current)) {
			for (const child of current) visit(child)
			return
		}
		if (!isNode(current)) return
		if (
			current.type === 'Identifier' &&
			IMPURE_AMBIENT_ROOTS.has(String(current.name))
		) {
			found = true
			return
		}
		if (
			(current.type === 'CallExpression' ||
				current.type === 'OptionalCallExpression') &&
			isNode(current.callee) &&
			current.callee.type === 'MemberExpression' &&
			!current.callee.computed
		) {
			const obj = current.callee.object
			const prop = current.callee.property
			if (
				isNode(obj) &&
				obj.type === 'Identifier' &&
				String(obj.name) === 'Math' &&
				isNode(prop) &&
				prop.type === 'Identifier' &&
				String(prop.name) === 'random'
			) {
				found = true
				return
			}
			if (
				isNode(prop) &&
				prop.type === 'Identifier' &&
				IMPURE_AMBIENT_METHODS.has(String(prop.name))
			) {
				found = true
				return
			}
		}
		for (const [key, value] of Object.entries(current)) {
			if (key === 'loc' || key === 'range' || key === 'parent') continue
			if (value && typeof value === 'object') visit(value)
		}
	}
	visit(node)
	return found
}

/**
 * Free identifiers excluding JS globals — the dependency set that matters
 * for evaluability. Note the analyzer additionally consults this set for
 * its CLIENT-portability checks (a thunk the factory can resolve) — same
 * helper, different scope vocabulary.
 */
export const dependenciesOf = (node: TsrxNode): Set<string> => {
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
	node: TsrxNode,
	scope: ReadonlySet<string>,
): boolean =>
	dependenciesOf(node).isSubsetOf(scope) && !containsImpureAmbient(node)
