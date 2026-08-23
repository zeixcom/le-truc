/**
 * Shared AST predicates/text-extraction helpers and the recognized-name
 * vocabulary (signal constructors, context members, parser factories, JS/DOM
 * globals, managed text props) for the TSRX compiler front end
 * (`compiler.ts`) and its lowering/classification/type-inference siblings.
 *
 * This module is a pure leaf: it holds no `@tsrx/core` VALUE import (only
 * the `TsrxNode` type, erased at compile time) — `compiler.ts` remains the
 * ONE module importing `@tsrx/core` for parsing (ADR 0023 sub-design 2).
 */

import type { TsrxNode } from '@tsrx/core'

/* === Vocabulary constants === */

/** Signal constructor names recognized in setup declarations. */
export const SIGNAL_CONSTRUCTORS: ReadonlySet<string> = new Set<string>([
	'createCell',
	'createState',
	'createList',
	'createStore',
	'deriveCell',
	'deriveList',
	'deriveStore',
])

/** Parser factory names recognized as ambients in `expose()` initializers. */
export const PARSER_FACTORIES: ReadonlySet<string> = new Set<string>([
	'asString',
	'asInteger',
	'asNumber',
	'asBoolean',
	'asEnum',
	'asClampedInteger',
	'asJSON',
])

/** Context members usable as free names in any client code position. */
export const CONTEXT_NAMES: ReadonlySet<string> = new Set<string>([
	'host',
	'internals',
])

/** Managed form props usable as string-literal lazy children (text-bindable). */
export const MANAGED_TEXT_PROPS: ReadonlySet<string> = new Set<string>([
	'validationMessage',
])

/**
 * Client-only context helpers (query/effect primitives) that exist only in
 * the generated client factory's context object — never in the server render
 * function's scope, even though `component.setup`'s plain `const` statements
 * are emitted verbatim into both (ADR 0023 sub-design 12). A setup const that
 * calls one of these directly is silently broken server-side; diagnosed as
 * TSRX013 rather than left to surface as a raw tsc "cannot find name" error.
 */
export const CLIENT_ONLY_PRIMITIVES: ReadonlySet<string> = new Set<string>([
	'first',
	'all',
	'watch',
	'on',
	'pass',
])

/**
 * JS standard globals never count against dependency provability — reading
 * `String(...)` does not make a thunk unprovable.
 */
export const JS_GLOBALS: ReadonlySet<string> = new Set<string>([
	'Array',
	'BigInt',
	'Boolean',
	'Date',
	'Error',
	'Infinity',
	'JSON',
	'Math',
	'NaN',
	'Number',
	'Object',
	'RegExp',
	'String',
	'Symbol',
	'decodeURIComponent',
	'decodeURI',
	'encodeURI',
	'encodeURIComponent',
	'globalThis',
	'isFinite',
	'isNaN',
	'parseFloat',
	'parseInt',
	'undefined',
	// DOM globals (generated handlers reference element/event types)
	'console',
	'crypto',
	'document',
	'window',
	'navigator',
	'performance',
	'CustomEvent',
	'DOMTokenList',
	'Document',
	'Element',
	'Event',
	'EventTarget',
	'FocusEvent',
	'FormData',
	'HTMLButtonElement',
	'HTMLDivElement',
	'HTMLElement',
	'HTMLFormElement',
	'HTMLInputElement',
	'HTMLSelectElement',
	'HTMLSpanElement',
	'HTMLTemplateElement',
	'HTMLTextAreaElement',
	'InputEvent',
	'Intl',
	'KeyboardEvent',
	'MouseEvent',
	'Node',
	'NodeList',
	'SubmitEvent',
	'URL',
	'URLSearchParams',
	'queueMicrotask',
	'requestAnimationFrame',
	'setInterval',
	'setTimeout',
	'structuredClone',
])

/* === AST predicates === */

export const isNode = (value: unknown): value is TsrxNode =>
	!!value &&
	typeof value === 'object' &&
	typeof (value as TsrxNode).type === 'string'

export const asArray = (value: unknown): TsrxNode[] =>
	Array.isArray(value) ? (value.filter(isNode) as TsrxNode[]) : []

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
 * Collect the identifiers a node reads that are NOT bound within it — its
 * free variables. Scope-aware enough for the sanctioned shapes: function
 * params, local declarators, property keys, and non-computed member
 * properties never count as reads.
 */
export const freeIdentifiers = (node: TsrxNode): Set<string> => {
	const free = new Set<string>()
	const visit = (current: unknown, bound: ReadonlySet<string>) => {
		if (Array.isArray(current)) {
			for (const child of current) visit(child, bound)
			return
		}
		if (!isNode(current)) return
		switch (current.type) {
			case 'Identifier':
				if (!bound.has(String(current.name))) free.add(String(current.name))
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
			case 'BlockStatement':
			case 'Program': {
				// Statements execute in order: a declaration adds its names to
				// scope for every statement that follows it.
				const inner = new Set(bound)
				for (const stmt of asArray(current.body)) {
					if (stmt.type === 'VariableDeclaration') {
						for (const decl of asArray(stmt.declarations))
							visit(decl.init, inner)
						const declared = new Set<string>()
						for (const decl of asArray(stmt.declarations))
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
				return
			}
			default:
				for (const [key, value] of Object.entries(current)) {
					if (key === 'loc' || key === 'range' || key === 'parent') continue
					// TS type positions name TYPES, not values — a cast's operand
					// type (`x as Foo[]`), a declaration's annotation, a function's
					// return type/generics, etc. Walking these generically would
					// count a type name (`Foo`) as a free VALUE identifier, wrongly
					// failing the harvest/thunk free-name gates for any initializer
					// that happens to use a type annotation or cast (LT-027).
					if (
						key === 'typeAnnotation' ||
						key === 'returnType' ||
						key === 'typeParameters' ||
						key === 'typeArguments' ||
						key === 'superTypeParameters' ||
						key === 'superTypeArguments'
					)
						continue
					if (isNode(value) || Array.isArray(value)) visit(value, bound)
				}
		}
	}
	visit(node, new Set())
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
	node: TsrxNode | null | undefined,
): string =>
	node && typeof node.start === 'number' && typeof node.end === 'number'
		? source.slice(node.start, node.end)
		: ''

export const attrName = (attr: TsrxNode): string =>
	jsxName(attr.name) ?? String(attr.name)

/** `onClick` → `click`; `onKeyup` → `keyup`. */
export const eventNameFromAttr = (name: string): string => {
	const rest = name.slice(2)
	return rest.charAt(0).toLowerCase() + rest.slice(1)
}
