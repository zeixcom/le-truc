# TODO — v1.1 Refactoring

Reference: `ARCHITECTURE.md` §v1.1 Specification

---

## Phase 1: Engine — New Factory Return Shape

> Unlocks all subsequent phases. Must be done first and pass existing tests.

- [ ] **1.1** Define `EffectDescriptor` type: `() => MaybeCleanup`
- [ ] **1.2** Define `FactoryResult<P>` type: `Array<EffectDescriptor | false | undefined>`
- [ ] **1.3** Define `FactoryContext<P>` type with `host`, `first`, `all`, `expose` (other helpers added in Phase 2/3)
- [ ] **1.4** Add new `ComponentFactory` overload in `component.ts` that accepts `FactoryContext<P>` and returns `FactoryResult<P>`
- [ ] **1.5** Implement `expose()` in `connectedCallback` — calls `#initSignals` immediately when invoked during factory execution
- [ ] **1.6** Modify `connectedCallback` to detect new vs old factory form (`Array.isArray(result)` vs `isRecord(result)`) and handle both
- [ ] **1.7** Wire up effect descriptor activation: after `resolveDependencies`, create `createScope`, iterate filtered array, call each descriptor
- [ ] **1.8** Verify all existing tests pass (v1.0 form unchanged)
- [ ] **1.9** Write test: minimal component using `expose()` + empty return array

## Phase 2: Core Helpers

> Can be done in parallel per helper once Phase 1 is complete. Each helper is independent.

### 2A: `run(source, handler)` — Property Effect

- [ ] **2A.1** Implement `run` wrapping `match` — single signal name (string → `host[name]`), single Signal/Memo, array form
- [ ] **2A.2** Implement `MatchHandlers` overload (`{ ok, nil, err }`)
- [ ] **2A.3** Ensure `run` returns an `EffectDescriptor` (thunk), not a live effect
- [ ] **2A.4** Add `run` to `FactoryContext`
- [ ] **2A.5** Write tests: single prop, direct signal, array form, MatchHandlers form, conditional `false &&` filtering

### 2B: `each(memo, callback)` — Collection Effect

- [ ] **2B.1** Implement `each` — wrapping `createEffect` that reads `memo.get()`, per-element scope, activates callback-returned descriptors
- [ ] **2B.2** Implement single-descriptor shortcut (callback returns one descriptor without array wrapper)
- [ ] **2B.3** Ensure per-element lifecycle: effects disposed when element leaves Memo, created when element enters
- [ ] **2B.4** Add `each` to `FactoryContext`
- [ ] **2B.5** Write tests: add/remove elements, nested `run` inside `each`, nested `on` inside `each`, single-descriptor shortcut

### 2C: `on(target, type, handler, options?)` — Event Binding

- [ ] **2C.1** Implement Element target overload — `(event, target)` unified handler signature, returns `EffectDescriptor`
- [ ] **2C.2** Implement Memo target overload — event delegation on query root, `element.contains(event.target)` matching
- [ ] **2C.3** Define `NON_BUBBLING_EVENTS` set: `focus`, `blur`, `scroll`, `resize`, `load`, `unload`, `error`, `toggle`, `mouseenter`, `mouseleave`, `pointerenter`, `pointerleave`, `abort`, `canplay`, `canplaythrough`, `durationchange`, `emptied`, `ended`, `loadeddata`, `loadedmetadata`, `loadstart`, `pause`, `play`, `playing`, `progress`, `ratechange`, `seeked`, `seeking`, `stalled`, `suspend`, `timeupdate`, `volumechange`, `waiting`
- [ ] **2C.4** Implement non-bubbling guard: DEV_MODE warns + falls back to per-element listeners; production silently falls back
- [ ] **2C.5** Preserve `{ prop: value }` return → `batch()` host update behavior
- [ ] **2C.6** Preserve passive event scheduling (`schedule()` for scroll, resize, touch, wheel)
- [ ] **2C.7** Add `on` to `FactoryContext`
- [ ] **2C.8** Write tests: element target, Memo delegation, non-bubbling fallback, `on` inside `each` (per-element), handler return batch update

### 2D: `pass(target, props)` — Inter-Component Binding

- [ ] **2D.1** Implement Element target overload — captures `host` from factory context, returns `EffectDescriptor`
- [ ] **2D.2** Implement Memo target overload — per-element lifecycle (swap on enter, restore on leave)
- [ ] **2D.3** Add `pass` to `FactoryContext`
- [ ] **2D.4** Write tests: single element, Memo target, signal restoration on disconnect, Memo element add/remove

## Phase 3: Context & Sensors

> Depends on Phase 1 (expose). Can be done in parallel with Phase 2.

### 3A: `provideContexts(contexts)` — bound to host

- [ ] **3A.1** Refactor `provideContexts` to accept just `contexts` array, capture `host` from factory context
- [ ] **3A.2** Returns `EffectDescriptor` for the return array
- [ ] **3A.3** Add `provideContexts` to `FactoryContext`
- [ ] **3A.4** Keep current `(contexts) => (host) => Cleanup` signature working for 4-param form
- [ ] **3A.5** Write test: context-media provider using new form

### 3B: `requestContext(context, fallback)` — bound to host

- [ ] **3B.1** Refactor `requestContext` to capture `host` from factory context, dispatch `ContextRequestEvent` from `host`
- [ ] **3B.2** Returns `Memo<T>` for use inside `expose()`
- [ ] **3B.3** Add `requestContext` to `FactoryContext`
- [ ] **3B.4** Keep current `(context, fallback) => Reader` signature working for 4-param form
- [ ] **3B.5** Write test: card-mediaqueries consumer using new form

### 3C: `createEventsSensor(target, init, events)` — element-based

- [ ] **3C.1** Refactor `createEventsSensor` to accept target element directly instead of UI key string
- [ ] **3C.2** `init` parameter accepts plain value (no `read()` wrapper needed)
- [ ] **3C.3** Drop `ui` from handler context — handler receives `{ event, target, prev }`
- [ ] **3C.4** Keep current signature working for 4-param form (or adapt 4-param callers)
- [ ] **3C.5** Write test: sensor with element target, verify event-driven updates

## Phase 4: Safety Utilities

> No dependencies on other phases. Can be done anytime.

- [ ] **4.1** Extract `safeSetAttribute(element, name, value)` from `src/effects/attribute.ts` — URL protocol validation, `on*` blocking
- [ ] **4.2** Promote `escapeHTML` from `examples/_common/escapeHTML.ts` to `src/util.ts` (or new `src/safety.ts`)
- [ ] **4.3** Implement `setTextPreservingComments(element, text)` — extract logic from `src/effects/text.ts`
- [ ] **4.4** Export all three from `index.ts`
- [ ] **4.5** Update `types/` declarations

## Phase 5: Migration — Convert Examples

> Depends on Phases 1–3. Components within each group can be migrated in parallel.

### 5A: Simple components (no collections, no pass, no context)

- [ ] **5A.1** `basic-hello` — simplest; good smoke test
- [ ] **5A.2** `basic-counter`
- [ ] **5A.3** `basic-button`
- [ ] **5A.4** `basic-number`
- [ ] **5A.5** `basic-pluralize`
- [ ] **5A.6** `card-blogmeta`
- [ ] **5A.7** `module-codeblock`
- [ ] **5A.8** `module-dialog`
- [ ] **5A.9** Run tests after each migration to verify

### 5B: Components with `pass`, sensors, or context

- [ ] **5B.1** `form-checkbox` — draft already exists, make it work
- [ ] **5B.2** `form-textbox` — uses `clearMethod`, `createEventsSensor`
- [ ] **5B.3** `basic-gauge` — uses `pass`
- [ ] **5B.4** `form-spinbutton` — uses `createMemo`, multiple `on` targets
- [ ] **5B.5** `context-media` — uses `provideContexts`
- [ ] **5B.6** `card-mediaqueries` — uses `requestContext`
- [ ] **5B.7** Run tests after each migration

### 5C: Components with `all()` collections

- [ ] **5C.1** `form-radiogroup` — `all('input[type="radio"]')`, `manageFocus`
- [ ] **5C.2** `module-tabgroup` — multiple `all()`, `createEventsSensor` on collection
- [ ] **5C.3** `module-carousel` — multiple `all()`, IntersectionObserver, complex interaction
- [ ] **5C.4** `module-pagination` — simple `all()` usage
- [ ] **5C.5** `module-scrollarea` — IntersectionObserver-based overflow detection
- [ ] **5C.6** Run tests after each migration

### 5D: Complex modules (collections + pass + async)

- [ ] **5D.1** `form-combobox` — 6 targets, pass, sensor, show, memos (see worked example in ARCHITECTURE.md)
- [ ] **5D.2** `form-listbox` — `all()` with per-element effects, `createTask`, `dangerouslySetInnerHTML`
- [ ] **5D.3** `module-list` — `asMethod`, `pass`, template cloning
- [ ] **5D.4** `module-catalog` — `all()` of Le Truc components, `pass` to collection
- [ ] **5D.5** `module-todo` — `createElementsMemo`, multiple `pass` targets
- [ ] **5D.6** `module-lazyload` — `createTask`, `dangerouslySetInnerHTML`
- [ ] **5D.7** `module-listnav` — hash synchronization, `pass`
- [ ] **5D.8** `security-test` — verify safety utilities work correctly
- [ ] **5D.9** Run full test suite across all 3 browsers

## Phase 6: Deprecation

> Depends on Phase 5 completion (all examples migrated, all tests passing).

- [ ] **6.1** Mark 4-param `defineComponent` overload as `@deprecated` in JSDoc
- [ ] **6.2** Mark `{ ui, props, effects }` return shape types as `@deprecated`
- [ ] **6.3** Mark `read()` as `@deprecated` — point to direct value access in factory closure
- [ ] **6.4** Mark built-in effects as `@deprecated`: `setText`, `setAttribute`, `toggleAttribute`, `setProperty`, `show`, `toggleClass`, `setStyle`, `dangerouslySetInnerHTML` — point to `run()` with imperative DOM updates
- [ ] **6.5** Mark v1.0 `on(type, handler)` (without target) as `@deprecated` — point to new `on(target, type, handler)`
- [ ] **6.6** Mark v1.0 `pass(props)` (without target) as `@deprecated` — point to new `pass(target, props)`
- [ ] **6.7** Update `types/` declarations to include `@deprecated` tags and new exports
- [ ] **6.8** Update `index.ts` — add new exports (safety utilities, new types)
- [ ] **6.9** Update `CLAUDE.md` — revise surprising behaviors for v1.1
- [ ] **6.10** Update `ARCHITECTURE.md` — mark v1.0 sections as historical, promote v1.1 as current
