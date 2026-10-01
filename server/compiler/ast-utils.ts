/**
 * Shared AST predicates, the one child-enumeration every estree walk runs
 * on (`forEachChild`), the scope-aware free-identifier walk, and
 * text-extraction helpers for the TSRX compiler front ends
 * (`frontend/tsrx/compiler.ts`, `frontend/tsx/compiler-tsx.ts`) and their
 * lowering/classification/type-inference siblings. The recognized-name
 * tables these walks consult live in `vocabulary.ts`.
 *
 * This module holds no `@tsrx/core` VALUE import (only the `AstNode` type,
 * erased at compile time) — `compiler.ts` remains the ONE module importing
 * `@tsrx/core` for parsing (ADR 0023 sub-design 2). Its one value import,
 * `eslint-visitor-keys`, is pure data with no Node-only path, so the
 * browser bundle (M25) stays clean.
 */

import { KEYS } from 'eslint-visitor-keys'
import type { AstNode } from './ast-node'

/* === AST predicates === */

export const isNode = (value: unknown): value is AstNode =>
	!!value &&
	typeof value === 'object' &&
	typeof (value as AstNode).type === 'string'

export const asArray = (value: unknown): AstNode[] =>
	Array.isArray(value) ? (value.filter(isNode) as AstNode[]) : []

/** The `.type` discriminator of an AST node, or null for non-nodes. */
export const nodeType = (node: unknown): string | null =>
	isNode(node) ? String(node.type) : null

/* === Child enumeration === */

/**
 * Whether a walk descends into TypeScript type positions. `'skip'` is the
 * default: types are erased, so a name in one is never a runtime read.
 * `'descend'` is for the one site where a type use still matters — an
 * authored import check, where `typeof createState` needs the import as
 * much as a value read does.
 */
export type TypePositions = 'skip' | 'descend'

/**
 * The keys a TS-aware parser hangs type positions on (a declaration's
 * annotation, a function's return type and generics, a call's or a class
 * heritage's type arguments). `eslint-visitor-keys` lists none of them on
 * the estree node types it knows; on the TS node types it does not know
 * (`TSAsExpression`, …) the fallback enumeration below drops them under
 * `'skip'`.
 */
const TYPE_POSITION_KEYS: ReadonlySet<string> = new Set([
	'typeAnnotation',
	'returnType',
	'typeParameters',
	'typeArguments',
	'superTypeParameters',
	'superTypeArguments',
])

/** Bookkeeping keys of a node of a type `eslint-visitor-keys` doesn't know. */
const NON_CHILD_KEYS: ReadonlySet<string> = new Set([
	'type',
	'start',
	'end',
	'loc',
	'range',
	'parent',
	'leadingComments',
	'trailingComments',
	'innerComments',
])

/**
 * Call `visit` on each direct child node of `node`, in the node's own key
 * order (the parser's, so "first found" results stay stable). Which keys
 * hold children is borrowed from `eslint-visitor-keys`, maintained against
 * every estree and JSX node type — the skip policy hand-rolled walks used to
 * re-answer, one list each (LT-229). Node types it doesn't know — TS nodes,
 * the TSRX directives (`JSXCodeBlock`, `JSXIfExpression`, …), the scoped
 * stylesheet's CSS nodes — fall back to every key that isn't bookkeeping.
 * Type-position keys follow `types` on both paths.
 */
export const forEachChild = (
	node: AstNode,
	visit: (child: AstNode) => void,
	types: TypePositions = 'skip',
): void => {
	const known = Object.hasOwn(KEYS, node.type) ? KEYS[node.type] : undefined
	for (const key of Object.keys(node)) {
		if (
			TYPE_POSITION_KEYS.has(key)
				? types === 'skip'
				: known
					? !known.includes(key)
					: NON_CHILD_KEYS.has(key)
		)
			continue
		const value = node[key]
		if (Array.isArray(value)) {
			for (const child of value) if (isNode(child)) visit(child)
		} else if (isNode(value)) visit(value)
	}
}

/**
 * Call `visit` on `node` and every node below it, parent before children.
 * Returning `false` from `visit` skips that node's subtree.
 */
export const walkNodes = (
	node: unknown,
	visit: (node: AstNode) => boolean | undefined | void,
	types: TypePositions = 'skip',
): void => {
	const step = (current: AstNode): void => {
		if (visit(current) === false) return
		forEachChild(current, step, types)
	}
	if (Array.isArray(node)) {
		for (const child of node) if (isNode(child)) step(child)
	} else if (isNode(node)) step(node)
}

/**
 * `() => host.<prop>` — the host-prop mirror pattern. Returns the property
 * name, or null when the thunk isn't a non-computed `host.<prop>` member
 * read. Shared by the analyzer (dispatch decision: `bindProperty`, not
 * `bindAttribute`) and the server emitter (render from the parser-exposed
 * prop's root attribute).
 */
export const hostPropOf = (thunk: AstNode): string | null => {
	const body = thunk.body
	if (!isNode(body) || body.type !== 'MemberExpression' || body.computed)
		return null
	const obj = body.object
	if (!isNode(obj) || obj.type !== 'Identifier' || String(obj.name) !== 'host')
		return null
	const prop = body.property
	if (!isNode(prop) || prop.type !== 'Identifier') return null
	return String(prop.name)
}

/**
 * Property names of an object literal. String-literal keys are accepted
 * alongside identifiers: CSS-y class/style tokens (`'has-error'`,
 * `'--gauge-color'`) are not valid JS identifiers and can ONLY be written
 * quoted. LT-221: the old "class maps never use string keys" assumption
 * silently dropped every quoted class key — the server rendered the
 * initial class and the client was emitted `bindClass(el, [])`, never
 * toggling it, with no diagnostic.
 */
export const objectKeys = (object: AstNode): string[] => {
	const keys: string[] = []
	if (nodeType(object) !== 'ObjectExpression') return keys
	for (const prop of asArray(object.properties)) {
		if (prop.type !== 'Property') continue
		const key = prop.key
		if (nodeType(key) === 'Identifier') keys.push(String((key as AstNode).name))
		else if (
			nodeType(key) === 'Literal' &&
			typeof (key as AstNode).value === 'string'
		)
			keys.push(String((key as AstNode).value))
	}
	return keys
}

/** `basic-counter` → `basicCounter` (a dashed name as a JS identifier). */
export const sanitizeVarName = (name: string): string =>
	name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

export const identifierName = (node: unknown): string | null =>
	isNode(node) && node.type === 'Identifier' ? String(node.name) : null

/** Tag/attribute names arrive as `JSXIdentifier` nodes, not `Identifier`. */
export const jsxName = (node: unknown): string | null =>
	isNode(node) &&
	(node.type === 'Identifier' || node.type === 'JSXIdentifier') &&
	typeof node.name === 'string'
		? node.name
		: null

/**
 * Call `onFree` on every `Identifier` node a node reads that is NOT bound
 * within it — its free variable reads, in walk order. Scope-aware enough
 * for the sanctioned shapes: function params, local declarators, loop and
 * catch bindings, property keys, and non-computed member properties never
 * count as reads; statements in a block (or a `.tsrx` `@{ }` code block)
 * bind their declarations for the statements that follow. Import
 * declarations introduce names rather than read them, so they are skipped
 * — and bind nothing, which is what lets the authored-import check see an
 * unimported read.
 *
 * The one scope walk both `freeIdentifiers` and the authored-import check
 * (`reportLeTrucImportMismatch`) run on — the latter used to carry its own
 * copy, which never grew the loop/catch cases or the `@{ }` render slot
 * (LT-229).
 */
export const forEachFreeIdentifier = (
	node: unknown,
	onFree: (identifier: AstNode) => void,
	types: TypePositions = 'skip',
): void => {
	const visit = (current: unknown, bound: ReadonlySet<string>) => {
		if (Array.isArray(current)) {
			for (const child of current) visit(child, bound)
			return
		}
		if (!isNode(current)) return
		switch (current.type) {
			case 'ImportDeclaration':
				return
			case 'Identifier':
				if (!bound.has(String(current.name))) onFree(current)
				return
			case 'MemberExpression':
				visit(current.object, bound)
				if (current.computed) visit(current.property, bound)
				return
			case 'Property':
				if (current.computed) visit(current.key, bound)
				visit(current.value, bound)
				return
			case 'ArrowFunctionExpression':
			case 'FunctionExpression':
			case 'FunctionDeclaration': {
				const inner = new Set(bound)
				const paramNames = new Set<string>()
				for (const param of asArray(current.params))
					collectBoundNames(param, paramNames)
				for (const n of paramNames) inner.add(n)
				visit(current.body, inner)
				return
			}
			case 'VariableDeclarator': {
				visit(current.init, bound)
				const declared = new Set<string>()
				collectBoundNames(current.id, declared)
				visit(current.id, new Set([...bound, ...declared]))
				return
			}
			case 'ForStatement': {
				// `for (let x = 0; ...) { ... }` — `init`'s declared name(s) must
				// be in scope for `test`/`update`/`body` too, not just the
				// declarator's own (self-only) re-visit `VariableDeclarator`
				// gives it. Without this case the loop variable falls through to
				// the generic `default` walk, unbound in every other clause —
				// found migrating `form-colorgraph.tsrx` (LT-088), a canvas-draw
				// `for (let x = 0; x < n; x++)` reported `x` itself as free.
				const inner = new Set(bound)
				if (
					isNode(current.init) &&
					current.init.type === 'VariableDeclaration'
				) {
					for (const decl of asArray(current.init.declarations))
						visit(decl.init, inner)
					const declared = new Set<string>()
					for (const decl of asArray(current.init.declarations))
						collectBoundNames(decl.id, declared)
					for (const name of declared) inner.add(name)
				} else {
					visit(current.init, inner)
				}
				visit(current.test, inner)
				visit(current.update, inner)
				visit(current.body, inner)
				return
			}
			case 'ForOfStatement':
			case 'ForInStatement': {
				// `for (const x of xs) { ... }` — same binding gap as
				// `ForStatement` above, for the `left` pattern instead of `init`.
				const inner = new Set(bound)
				visit(current.right, bound)
				const declared = new Set<string>()
				const left = current.left
				if (isNode(left) && left.type === 'VariableDeclaration') {
					for (const decl of asArray(left.declarations))
						collectBoundNames(decl.id, declared)
				} else {
					collectBoundNames(left, declared)
				}
				for (const name of declared) inner.add(name)
				visit(current.body, inner)
				return
			}
			case 'CatchClause': {
				// `catch (e) { ... }` — same gap for the catch binding.
				const inner = new Set(bound)
				if (current.param) {
					const declared = new Set<string>()
					collectBoundNames(current.param, declared)
					for (const name of declared) inner.add(name)
				}
				visit(current.body, inner)
				return
			}
			case 'BlockStatement':
			case 'Program':
			case 'JSXCodeBlock': {
				// Statements execute in order: a declaration adds its names to
				// scope for every statement that follows it. The `.tsrx` `@{ }`
				// container is a JSXCodeBlock holding plain statements plus a
				// `render` slot (the template) that sees all of them.
				const inner = new Set(bound)
				for (const stmt of asArray(current.body)) {
					if (stmt.type === 'VariableDeclaration') {
						// `const handleUp = () => { ...; el.removeEventListener(
						// 'up', handleUp) }` — a function EXPRESSION referencing
						// its own name inside its own (deferred) body, the const
						// analog of a recursive named `FunctionDeclaration`
						// (handled below). By the time the closure actually
						// runs, the const is long since assigned — bind the
						// name before visiting a single declarator's own
						// function/arrow initializer so this resolves instead
						// of reporting the const's own name as free. Found
						// migrating `form-colorgraph.tsrx` (LT-088): a
						// pointerdown handler's own `handleUp` unregisters
						// itself by reference.
						const declarations = asArray(stmt.declarations)
						const selfNames = new Set<string>()
						for (const decl of declarations) {
							const declName = identifierName(decl.id)
							if (
								declName &&
								isNode(decl.init) &&
								(decl.init.type === 'ArrowFunctionExpression' ||
									decl.init.type === 'FunctionExpression')
							)
								selfNames.add(declName)
						}
						const initScope = selfNames.size
							? new Set([...inner, ...selfNames])
							: inner
						for (const decl of declarations) visit(decl.init, initScope)
						const declared = new Set<string>()
						for (const decl of declarations)
							collectBoundNames(decl.id, declared)
						for (const name of declared) inner.add(name)
					} else if (
						stmt.type === 'FunctionDeclaration' &&
						identifierName(stmt.id)
					) {
						inner.add(identifierName(stmt.id) as string)
						visit(stmt, inner)
					} else {
						visit(stmt, inner)
					}
				}
				if (current.type === 'JSXCodeBlock') visit(current.render, inner)
				return
			}
			default:
				forEachChild(current, child => visit(child, bound), types)
		}
	}
	visit(node, new Set())
}

/**
 * The names a node reads that are NOT bound within it — its free
 * variables (`forEachFreeIdentifier`, type positions skipped). A type name
 * (`x as Foo[]`, an annotation, a return type) is never a VALUE read;
 * counting one would wrongly fail the harvest/thunk free-name gates for any
 * initializer that happens to carry a type annotation or cast (LT-027).
 */
export const freeIdentifiers = (node: AstNode): Set<string> => {
	const free = new Set<string>()
	forEachFreeIdentifier(node, id => free.add(String(id.name)))
	return free
}

/** Names declared by a binding pattern (params, declarator ids). */
export const collectBoundNames = (
	pattern: unknown,
	into: Set<string>,
): void => {
	if (Array.isArray(pattern)) {
		for (const p of pattern) collectBoundNames(p, into)
		return
	}
	if (!isNode(pattern)) return
	switch (pattern.type) {
		case 'Identifier':
			into.add(String(pattern.name))
			return
		case 'AssignmentPattern':
			collectBoundNames(pattern.left, into)
			return
		case 'ObjectPattern':
			for (const prop of asArray(pattern.properties)) {
				if (prop.type === 'RestElement') collectBoundNames(prop.argument, into)
				else if (prop.type === 'Property') collectBoundNames(prop.value, into)
			}
			return
		case 'ArrayPattern':
			for (const element of asArray(pattern.elements))
				collectBoundNames(element, into)
			return
		case 'RestElement':
			collectBoundNames(pattern.argument, into)
			return
		default:
	}
}

/**
 * JSX text semantics: whitespace touching a newline boundary collapses; a
 * whitespace-only node containing a newline disappears (returns "").
 */
export const collapseJsxText = (raw: string): string => {
	if (/^[ \t]*\n/.test(raw)) raw = raw.replace(/^[ \t]*\n[ \t]*/, '')
	if (/\n[ \t]*$/.test(raw)) raw = raw.replace(/\n[ \t]*$/, '')
	if (raw.includes('\n')) raw = raw.replace(/\s*\n[ \t]*/g, ' ')
	return raw
}

/** Source text of a node, by its `[start, end)` offsets. */
export const text = (
	source: string,
	node: AstNode | null | undefined,
): string =>
	node && typeof node.start === 'number' && typeof node.end === 'number'
		? source.slice(node.start, node.end)
		: ''

export const attrName = (attr: AstNode): string => {
	// `truc:pass` parses as a JSXNamespacedName (namespace + name), which
	// `jsxName` deliberately does not flatten — it is also used for element
	// tags, where a namespace would mean something else. Host-owned
	// attributes are namespaced (LT-053) to stay collision-proof against a
	// user prop legitimately called `pass`.
	const name = attr.name
	if (isNode(name) && name.type === 'JSXNamespacedName') {
		const ns = jsxName(name.namespace)
		const local = jsxName(name.name)
		if (ns !== null && local !== null) return `${ns}:${local}`
	}
	return jsxName(name) ?? String(name)
}

/** `onClick` → `click`; `onKeyup` → `keyup`. */
export const eventNameFromAttr = (name: string): string => {
	const rest = name.slice(2)
	return rest.charAt(0).toLowerCase() + rest.slice(1)
}
