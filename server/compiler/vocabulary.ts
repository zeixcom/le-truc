/**
 * The recognized-name vocabulary of the TSRX compiler: signal constructors,
 * context members, parser factories, real `@zeix/le-truc` exports, reserved
 * and managed prop names, JS/DOM globals. Name tables only — the AST walks
 * that consult them live in `ast-utils.ts`; DOM interface knowledge the
 * generated client needs (lib.dom type names) lives emitter-side.
 *
 * A pure leaf with no imports at all. Several tables duplicate a runtime
 * list since the compiler never imports the library; the parity tests
 * (`globals.test.ts`, `diagnostics.test.ts`) pin them.
 */

/**
 * Signal constructors whose result is MUTABLE, hence Slot-backed — the
 * declared family (`setup-extraction.ts`). A subset of `SIGNAL_CONSTRUCTORS`
 * by construction: the superset spreads this tuple.
 */
export const MUTABLE_SIGNAL_CONSTRUCTOR_NAMES = [
	'createCell',
	'createState',
	'createList',
	'createStore',
] as const

export const MUTABLE_SIGNAL_CONSTRUCTORS: ReadonlySet<string> = new Set<string>(
	MUTABLE_SIGNAL_CONSTRUCTOR_NAMES,
)

/** Signal constructor names recognized in setup declarations. */
export const SIGNAL_CONSTRUCTOR_NAMES = [
	...MUTABLE_SIGNAL_CONSTRUCTOR_NAMES,
	'deriveCell',
	'deriveList',
	'deriveStore',
	'createMemo',
	'createSensor',
	'createTask',
] as const

export const SIGNAL_CONSTRUCTORS: ReadonlySet<string> = new Set<string>(
	SIGNAL_CONSTRUCTOR_NAMES,
)

/**
 * Signal constructors whose seed is a scalar value — the family a
 * `harvest(seed, parser)` marker (ADR 0046 s7, LT-443) and the LTC077
 * refusal apply to. `createList` takes the marker's map form (LT-429), and
 * a derived callback re-derives instead of parsing a seed back.
 */
export const SCALAR_HARVEST_CONSTRUCTORS: ReadonlySet<string> = new Set([
	'createCell',
	'createState',
	'createStore',
])

/** Parser factory names recognized as ambients in `expose()` initializers. */
export const PARSER_FACTORY_NAMES = [
	'asString',
	'asInteger',
	'asNumber',
	'asBoolean',
	'asEnum',
	'asClampedInteger',
	'asJSON',
] as const

export const PARSER_FACTORIES: ReadonlySet<string> = new Set<string>(
	PARSER_FACTORY_NAMES,
)

/**
 * Attribute names whose ABSENCE carries meaning (CHECKLIST §5): `hidden`
 * omitted means visible, `disabled` omitted means enabled AND submittable,
 * likewise `checked`/`selected`/`aria-expanded`. A reactive binding on one of
 * these that the server can't render an initial value for (LTC034) doesn't
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
 * DOM dirty flag (LT-116). The WRITE-side counterpart of `DIRTY_FLAG_ATTRS`:
 * a reactive thunk targeting one of these attr×tag combinations must lower
 * to a property write, because rewriting/removing the content attribute no
 * longer moves the live property once the control is dirty (user
 * interaction, autofill, or any prior JS property write) — the
 * form-radiogroup mutual-exclusion break (NOTES LT-092). The hand-written
 * corpus precedent is a property write in the `each()` callback
 * (`radio.checked = isChecked`), not `setAttribute`.
 *
 * `button` is deliberately absent: its `value` attribute/property pair has
 * no dirty flag (the property always reflects the attribute). `option` is
 * present for `selected` (dirtiness applies); `select`/`textarea` for
 * `value`. Kept as a literal tuple so the client emitter's tag → lib.dom
 * interface table (`emit-client.ts`) is checked exhaustive against it.
 */
export const DIRTY_FLAG_CONTROL_TAG_NAMES = [
	'input',
	'select',
	'textarea',
	'option',
] as const

export type DirtyFlagControlTag = (typeof DIRTY_FLAG_CONTROL_TAG_NAMES)[number]

export const DIRTY_FLAG_CONTROL_TAGS: ReadonlySet<string> = new Set<string>(
	DIRTY_FLAG_CONTROL_TAG_NAMES,
)

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
 * this set). Composed from the signal-constructor and parser-factory
 * tuples, so those stay subsets by construction; the remainder is
 * hand-listed, and `globals.test.ts` pins the whole set equal to the
 * barrel's runtime exports.
 */
export const REAL_EXPORT_NAMES: ReadonlySet<string> = new Set<string>([
	...SIGNAL_CONSTRUCTOR_NAMES,
	...PARSER_FACTORY_NAMES,
	// @zeix/cause-effect bridge (index.ts re-exports)
	'abort',
	'batch',
	'CircularDependencyError',
	'createCollection',
	'createComputed',
	'createEffect',
	'createMutableSignal',
	'createScope',
	'createSignal',
	'createSlot',
	'createTask',
	'DEEP_EQUALITY',
	'DEFAULT_EQUALITY',
	'DuplicateKeyError',
	'deriveSignal',
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
	'sanitizeHtml',
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
	'UnsafeAttributeError',
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
 * throw is contained (LT-155) the compiler carries the loud half: LTC028
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
 * factory has returned throws `NoActiveCollectorError`; LTC013 (LT-157d)
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
 * LTC010's family (LT-058) catches it at compile time instead, naming the
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
 * are emitted verbatim into both (ADR 0024 sub-design 12). A setup const that
 * calls one of these directly used to be the `LTC013` error; under tiering
 * (LT-165 step 5, ADR 0029 s5) it is a routing signal, and the tier-aware
 * server emit drops the statement from the render function rather than
 * emitting a call that cannot resolve.
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
	'Map',
	'Math',
	'NaN',
	'Number',
	'Object',
	'Promise',
	'RegExp',
	'Set',
	'String',
	'Symbol',
	'WeakMap',
	'WeakSet',
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
	'location',
	'history',
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
	'IntersectionObserver',
	'ResizeObserver',
	'SubmitEvent',
	'URL',
	'URLSearchParams',
	'cancelAnimationFrame',
	'clearInterval',
	'clearTimeout',
	'queueMicrotask',
	'requestAnimationFrame',
	'setInterval',
	'setTimeout',
	'structuredClone',
])
