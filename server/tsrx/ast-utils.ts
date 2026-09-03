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
	'createMemo',
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

/**
 * Attribute names whose ABSENCE carries meaning (CHECKLIST §5): `hidden`
 * omitted means visible, `disabled` omitted means enabled AND submittable,
 * likewise `checked`/`selected`/`aria-expanded`. A reactive binding on one of
 * these that the server can't render an initial value for (TSRX034) doesn't
 * degrade neutrally like an ordinary omitted attribute (`title`, `class`) —
 * it renders the more dangerous of the two states regardless of what the
 * author intended.
 */
export const SEMANTICALLY_LOADED_ATTRS: ReadonlySet<string> = new Set<string>([
	'hidden',
	'disabled',
	'checked',
	'selected',
	'aria-expanded',
])

/**
 * Attributes with a native "dirty flag" (CHECKLIST §6): the content
 * attribute and the live IDL property diverge once the user (or the
 * browser, via session restore/autofill/bfcache) has interacted with the
 * control, and only the live property reflects that interaction. Harvesting
 * one of these via `getAttribute` at connect time reads the SERVER-rendered
 * value and silently discards whatever the user already typed/toggled in
 * the pre-upgrade window — exactly the window people are most likely to be
 * interacting in. Harvesting the live property instead is always correct:
 * on a clean (never-interacted) control the property already equals the
 * attribute-derived initial value; on a dirty one, the property is the only
 * source that still has it.
 */
export const DIRTY_FLAG_ATTRS: ReadonlySet<string> = new Set<string>([
	'value',
	'checked',
	'selected',
])

/**
 * Native tags whose `value`/`checked`/`selected` IDL properties carry the
 * DOM dirty flag (LT-116) — mapped to the lib.dom interface the generated
 * client needs so `bindProperty`'s keyed setter typechecks. The WRITE-side
 * counterpart of `DIRTY_FLAG_ATTRS`: a reactive thunk targeting one of
 * these attr×tag combinations must lower to a property write, because
 * rewriting/removing the content attribute no longer moves the live
 * property once the control is dirty (user interaction, autofill, or any
 * prior JS property write) — the form-radiogroup mutual-exclusion break
 * (NOTES LT-092). The hand-written corpus precedent is a property write in
 * the `each()` callback (`radio.checked = isChecked`), not `setAttribute`.
 *
 * `button` is deliberately absent: its `value` attribute/property pair has
 * no dirty flag (the property always reflects the attribute). `option` is
 * present for `selected` (dirtiness applies); `select`/`textarea` for
 * `value`. Compiler-side literal, same duplication precedent as
 * `DIRTY_FLAG_ATTRS` itself — the TSRX compiler never imports lib.dom
 * types, it only emits names the generated client resolves.
 */
export const DIRTY_FLAG_CONTROL_TAGS: ReadonlyMap<string, string> = new Map([
	['input', 'HTMLInputElement'],
	['select', 'HTMLSelectElement'],
	['textarea', 'HTMLTextAreaElement'],
	['option', 'HTMLOptionElement'],
])

/**
 * Does this attr×tag combination hit a native dirty-flag IDL property
 * (LT-116)? The reactive-attr dispatch uses this to lower thunks to
 * `bindProperty` — regardless of the thunk's own value type, since the
 * attribute/property divergence is a property of the TARGET, not of the
 * thunk: a string `value` thunk over an `<input>` desyncs from the
 * attribute exactly as a boolean `checked` thunk does once the control is
 * dirty.
 */
export const isDirtyFlagControlAttr = (tag: string, attr: string): boolean =>
	DIRTY_FLAG_ATTRS.has(attr) && DIRTY_FLAG_CONTROL_TAGS.has(tag)

/**
 * Context members usable as free names in any client code position —
 * `host`/`internals` plus the Web Components Community Protocol helpers
 * (LT-035, ADR 0024 sub-design 15): `requestContext(Context, fallback)` in a
 * setup const declaration and `provideContexts([...])` as a bare setup
 * statement. Both are `FactoryContext` members, never module imports.
 */
export const CONTEXT_NAMES: ReadonlySet<string> = new Set<string>([
	'host',
	'internals',
	'requestContext',
	'provideContexts',
])

/**
 * FactoryContext members the generated client DESTRUCTURES rather than
 * imports from '@zeix/le-truc' (emit-client's context-vs-module split).
 * Kept as a literal array alongside the Set so the parity test can assert,
 * type-level, that every member is a key of the real `FactoryContext`
 * (globals.test.ts) — a `@zeix/le-truc` rename/removal then fails tsc.
 * `host`/`internals`/`requestContext`/`provideContexts` also live on the
 * context but arrive through the analyzer's ambient collection
 * (`CONTEXT_NAMES`), not this list; `each`/`reconcile`/`defineComponent`/
 * `bind*`/parsers/signal constructors are module exports.
 */
export const FACTORY_CONTEXT_MEMBER_NAMES = [
	'all',
	'expose',
	'first',
	'on',
	'pass',
	'watch',
] as const

export const FACTORY_CONTEXT_MEMBERS: ReadonlySet<string> = new Set<string>(
	FACTORY_CONTEXT_MEMBER_NAMES,
)

/**
 * Value exports of the `@zeix/le-truc` package barrel (`index.ts`) — the
 * names an authored `.tsrx` source may legitimately `import { … } from
 * '@zeix/le-truc'` (ADR 0024 sub-design 16: real exports are imported
 * explicitly; the FactoryContext vocabulary is ambient and disjoint from
 * this set). Hand-maintained against the barrel — the duplication
 * precedent is `MANAGED_FORM_MEMBERS`; a barrel change that forgets this
 * list fails the corpus check, since a newly exported name used in
 * authored code would fire TSRX036 until listed here.
 */
export const REAL_EXPORT_NAMES: ReadonlySet<string> = new Set<string>([
	// @zeix/cause-effect bridge (index.ts re-exports)
	'abort',
	'batch',
	'CircularDependencyError',
	'createCell',
	'createCollection',
	'createComputed',
	'createEffect',
	'createList',
	'createMemo',
	'createMutableSignal',
	'createScope',
	'createSensor',
	'createSignal',
	'createSlot',
	'createState',
	'createStore',
	'createTask',
	'DEEP_EQUALITY',
	'DEFAULT_EQUALITY',
	'DuplicateKeyError',
	'deriveCell',
	'deriveList',
	'deriveSignal',
	'deriveStore',
	'EffectConvergenceError',
	'InvalidCallbackError',
	'InvalidSignalValueError',
	'InvalidStoreMutationError',
	'isAsyncFunction',
	'isCell',
	'isCollection',
	'isComputed',
	'isDerivedList',
	'isFunction',
	'isList',
	'isMemo',
	'isMutableCell',
	'isMutableList',
	'isMutableSignal',
	'isMutableStore',
	'isPending',
	'isRecord',
	'isSensor',
	'isSignal',
	'isSignalOfType',
	'isSlot',
	'isState',
	'isStore',
	'isTask',
	'match',
	'NullishSignalValueError',
	'PromiseValueError',
	'ReadonlySignalError',
	'RequiredOwnerError',
	'SKIP_EQUALITY',
	'UnresolvableKeyError',
	'UnsetSignalValueError',
	'unown',
	'untrack',
	// src/bindings
	'bindAria',
	'bindAttribute',
	'bindClass',
	'bindProperty',
	'bindState',
	'bindStyle',
	'bindText',
	'bindVisible',
	'configureHtmlSanitizer',
	'dangerouslyBindInnerHTML',
	'escapeHTML',
	'safeSetAttribute',
	'setTextPreservingComments',
	// src/component, src/errors
	'defineComponent',
	'DependencyTimeoutError',
	'ExtensionCollisionError',
	'InvalidComponentNameError',
	'InvalidCustomElementError',
	'InvalidPassPropertyError',
	'InvalidPropertyNameError',
	'InvalidReactivesError',
	'InvalidSelectorError',
	'InvalidTemplateError',
	'MissingElementError',
	'NoActiveCollectorError',
	// src/extensions, src/helpers, src/scheduler
	'observedAttributes',
	'formAssociated',
	'formAssociatedCheckbox',
	'relayValidity',
	'CONTEXT_REQUEST',
	'ContextRequestEvent',
	'createContext',
	'createElementsMemo',
	'query',
	'queryAll',
	'each',
	'reconcile',
	'schedule',
	'throttle',
	// src/parsers, src/types
	'asBoolean',
	'asJSON',
	'asClampedInteger',
	'asInteger',
	'asNumber',
	'asEnum',
	'asString',
	'asParser',
	'defineMethod',
	'isMethodProducer',
	'isParser',
	'RESERVED_WORDS_LIST',
])

/**
 * Property names that must never be a reactive component property
 * (`src/types.ts`'s `RESERVED_WORDS_LIST`, duplicated here since the TSRX
 * compiler doesn't import the runtime library). Every one is an inherited
 * own-property of `Object`, so `component.ts`'s `#initSignals` checks them
 * BEFORE its `prop in this` guard — that ordering, not the throw escaping,
 * is what protects the prototype chain (ADR 0028 sub-design 5). Since the
 * throw is contained (LT-155) the compiler carries the loud half: TSRX028
 * (LT-157a).
 */
export const RESERVED_PROP_NAMES: ReadonlySet<string> = new Set<string>([
	'constructor',
	'prototype',
	'__proto__',
	'toString',
	'valueOf',
	'hasOwnProperty',
	'isPrototypeOf',
	'propertyIsEnumerable',
	'toLocaleString',
])

/**
 * FactoryContext helpers that push an effect descriptor into the ambient
 * collector (`src/internal.ts`'s `pushDescriptor`). Calling one after the
 * factory has returned throws `NoActiveCollectorError`; TSRX013 (LT-157d)
 * decides the statically visible half of that.
 */
export const COLLECTOR_HELPERS: ReadonlySet<string> = new Set<string>([
	'watch',
	'on',
	'pass',
	'provideContexts',
	'each',
	'reconcile',
])

/** Managed form props usable as string-literal lazy children (text-bindable). */
export const MANAGED_TEXT_PROPS: ReadonlySet<string> = new Set<string>([
	'validationMessage',
])

/**
 * Member names `formAssociated()`/`formAssociatedCheckbox()` install on the
 * prototype (`src/extensions/form.ts`'s `MANAGED_FORM_MEMBERS`, duplicated
 * here since the TSRX compiler doesn't import the runtime library). Exposing
 * any of these shadows the managed member — `expose()` already throws
 * `InvalidPropertyNameError` for it at RUNTIME (component.ts's
 * `reservedMembers` check), but only once the component actually connects;
 * TSRX010's family (LT-058) catches it at compile time instead, naming the
 * exact source line and the extension it collides with. `value`/`checked`
 * are the deliberate exceptions the component MUST expose — never included
 * here; the variant-specific reset-baseline prop (`defaultValue`/
 * `defaultChecked`, LT-057) is added by the caller, since which one applies
 * depends on `config.form`.
 */
export const MANAGED_FORM_MEMBERS: ReadonlySet<string> = new Set<string>([
	'form',
	'name',
	'labels',
	'validity',
	'validationMessage',
	'willValidate',
	'checkValidity',
	'reportValidity',
	'setCustomValidity',
	'disabled',
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
	'requestContext',
	'provideContexts',
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
	'HTMLCanvasElement',
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
	'PointerEvent',
	'ResizeObserver',
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

/** The `.type` discriminator of an AST node, or null for non-nodes. */
export const nodeType = (node: unknown): string | null =>
	isNode(node) ? String(node.type) : null

/**
 * `() => host.<prop>` — the host-prop mirror pattern. Returns the property
 * name, or null when the thunk isn't a non-computed `host.<prop>` member
 * read. Shared by the analyzer (dispatch decision: `bindProperty`, not
 * `bindAttribute`) and the server emitter (render from the parser-exposed
 * prop's root attribute).
 */
export const hostPropOf = (thunk: TsrxNode): string | null => {
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
 * Property names of an object literal keyed by identifier. `allowStrings`
 * (style maps) also accepts string-literal keys — CSS custom properties
 * (`'--gauge-color'`) are not valid JS identifiers and must be quoted at
 * the call site; class maps never use them.
 */
export const objectKeys = (
	object: TsrxNode,
	opts: { allowStrings: boolean },
): string[] => {
	const keys: string[] = []
	if (nodeType(object) !== 'ObjectExpression') return keys
	for (const prop of asArray(object.properties)) {
		if (prop.type !== 'Property') continue
		const key = prop.key
		if (nodeType(key) === 'Identifier')
			keys.push(String((key as TsrxNode).name))
		else if (
			opts.allowStrings &&
			nodeType(key) === 'Literal' &&
			typeof (key as TsrxNode).value === 'string'
		)
			keys.push(String((key as TsrxNode).value))
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
			case 'Program': {
				// Statements execute in order: a declaration adds its names to
				// scope for every statement that follows it.
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

export const attrName = (attr: TsrxNode): string => {
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
