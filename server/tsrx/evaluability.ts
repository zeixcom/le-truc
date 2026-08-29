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
import type { ComponentIR } from './ir'

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

/**
 * Host props with a server-rendered root attribute (`kind: 'server'`) that
 * is also Parser-exposed — the substitutable set for {@link hostDerivedFold}
 * (CHECKLIST §5, LT-085): the root attribute's own `exprText` IS the prop's
 * server-side seed value (DOM-is-truth, ADR 0003), the same fact
 * `emit-server.ts`'s bare-mirror case (`hostPropOf`, ast-utils.ts) already
 * relies on.
 */
export const foldableHostProps = (
	component: ComponentIR,
): ReadonlySet<string> => {
	const names = new Set<string>()
	for (const attr of component.root.attrs)
		if (attr.kind === 'server' && component.parserExposeProps.has(attr.name))
			names.add(attr.name)
	return names
}

/** One `host.<prop>` member read replaced during {@link hostDerivedFold}. */
export type HostPropRead = { start: number; end: number; prop: string }

/**
 * Whether `node` reads ONLY `host.<prop>` members (each `prop` in
 * `foldable`) combined via pure JS operators — no bare/computed `host`
 * escape, no other free non-global name, no impure ambient. Widens the
 * server-fold rule beyond the bare `() => host.<prop>` mirror (`hostPropOf`,
 * ast-utils.ts) to derived reads like `() => host.value <= host.min` or
 * `() => !host.editing` (CHECKLIST §5, LT-085) — `emit-server.ts` splices
 * each returned range in place with the corresponding root attribute's
 * server expression to fold the whole thunk to an initial value; TSRX034
 * (`analysis/effects.ts`) treats a non-null result the same as a bare
 * mirror when deciding whether omission is safe.
 *
 * All-or-nothing: one `host` read that isn't a member of `foldable` (a
 * signal-shaped prop the root doesn't render, a computed member, `host`
 * itself escaping as a bare value) disqualifies the WHOLE expression —
 * substituting only some of several `host.<prop>` reads would fold a
 * plausible-looking but wrong initial value, worse than omitting the
 * attribute entirely and letting the client's first pass render it.
 */
export const hostDerivedFold = (
	node: TsrxNode,
	foldable: ReadonlySet<string>,
): readonly HostPropRead[] | null => {
	if (containsImpureAmbient(node)) return null
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
				if (!bound.has(name) && name === 'host') escaped = true
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
					})
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
	if (others.size > 0) return null
	return reads
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
	exprTextOf: (prop: string) => string,
): string => {
	let out = ''
	let cursor = 0
	for (const r of [...reads].sort((a, b) => a.start - b.start)) {
		out += thunkText.slice(cursor, r.start - thunkStart)
		out += `(${exprTextOf(r.prop)})`
		cursor = r.end - thunkStart
	}
	out += thunkText.slice(cursor)
	return out
}
