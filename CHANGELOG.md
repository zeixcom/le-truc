# Changelog

## [Unreleased]

### Added

- **ElementInternals support via `{ formAssociated: true }` option and managed form-control convention**: `defineComponent(name, factory, { formAssociated: true })` exposes a reactive `value` property and the library manages form value sync, reset, state restore, and `<fieldset disabled>`-aware `disabled` state. The generated host also gets a native-parity contract (`form`, `name`, `labels`, `validity`, `checkValidity()`, `setCustomValidity()`, …) delegating to `internals`, so a typical form component writes **zero ElementInternals code**. `expose()` guards against redeclaring any managed member name. See [ADR 0016](adr/0016-element-internals-for-form-association-and-states.md).
- **`internals` on `FactoryContext`**: the `ElementInternals` object (`null` if `attachInternals()` failed) is exposed as the escape hatch for typed validity flags and custom `:state()` pseudo-classes — available on every component, not only form-associated ones.
- **`bindState(internals, token)` binding for custom `:state()` pseudo-classes**: the state-styling analogue of `bindClass`, but component-owned — it can't be clobbered by consumer code rewriting the host's `class` attribute. See [ADR 0016](adr/0016-element-internals-for-form-association-and-states.md) §8.
- **`FormAssociatedElement` interface and `ComponentOptions` type export** for typing form-associated tag-name-map declarations and `defineComponent`'s third parameter.
- **Implicit effect collection**: `watch()`, `on()`, `pass()`, `each()`, and `provideContexts()` now register themselves when called — no `return` needed. Explicit `return [...]` still works (dual support, deprecated as of v3.0). See [ADR 0018](adr/0018-implicit-effect-collection-via-ambient-context.md).
- **`run(descriptor)` helper** on `FactoryContext`, for registering a hand-authored `EffectDescriptor` (e.g. wrapping `IntersectionObserver`) that no other helper produces — the counterpart to implicit collection for raw descriptors.
- **`reconcile(container, template, source, bindItem)`**: new top-level primitive that syncs a keyed reactive data source (`List<T>` or `Collection<T>` from `@zeix/cause-effect`) to a container's children — Le Truc's first data-driven DOM creation, and the ownership complement of `each()` (which enhances DOM the component does *not* own). Entering keys clone the `<template>`'s single root element and mount `bindItem(element, item, key)` in a root-keyed scope (the ADR 0014 ownership discipline); leaving keys dispose their scope, then their element is removed; survivors are moved with `insertBefore()` — always reused, never recreated. The sync is strictly one-way, data → DOM. The first run **adopts** server-rendered children carrying `data-key` (`bindItem` runs for adopted elements too and is responsible for its own idempotency); keyed children not in the source and all unkeyed children are removed (self-cleaning container). Children carrying `data-unreconciled` are exempt — never removed, never repositioned, no `bindItem` — a permanent public SSR/interaction contract (drag-and-drop markers, mid-stream server items); an element `reconcile()` itself placed that later gains the attribute still claims its key, so a mid-drag re-run cannot clone a duplicate. Keyed elements are positioned relative to the *keyed subset*, not absolute child index, so unmanaged elements interspersed in the container do not drift keyed positions. The driving effect tracks structural changes only (the source's keys); per-item value changes flow through the `byKey` signal passed to `bindItem`. See [ADR 0017](adr/0017-keyed-template-clone-reconciliation-for-lists.md).
- **`InvalidTemplateError`**: new `TypeError` subclass thrown by `reconcile()` at activation (inside `connectedCallback`, per the ADR 0007 deferred-activation pattern) when the passed template's content does not contain exactly one root element — named after the container it was meant to fill.

### Changed

- **`module-list` and `module-todo` examples migrated to `reconcile()`**: both examples' hand-written key-diffing `watch()` blocks are deleted. `module-todo`'s drag-and-drop is refactored to the intended ownership split: `reconcile()` is the sole writer to the container's structural children — keyboard `moveItem()` and pointer drop now commit reorders via `list.update()` instead of mutating the DOM directly — while the event handlers own transient decoration (drop marker, `dragging` class, inline position styles) imperatively, with `data-unreconciled` pinning the marker and the dragged item against mid-drag reconcile re-runs, stripped on drop/cancel before committing.

### Fixed

- **Disconnect cleanup for hand-authored descriptors**: a raw `EffectDescriptor` returned via `return [...]` had its cleanup silently discarded, since `activateResult()` discards each descriptor's return value — `disconnectedCallback` never ran it. Fixed in the example components that had this bug (`module-carousel`, `module-ticker`, `module-listnav`, `module-scrollarea`) by migrating them to `run()`, which wraps the descriptor in `createScope()` so its cleanup registers correctly.

## 2.2.0

### Added

- **Custom Elements Manifest**: the package now ships `custom-elements.json`, generated by the new `@zeix/cem-plugin-le-truc` analyzer plugin, which understands Le Truc's `defineComponent<Props>(tagName, factory)` pattern — properties from `Props`, attributes from `as*` parsers in `expose()`, plus `@slot`/`@fires`/`@csspart`/`@cssprop`/`@demo` JSDoc tags. Connect-time attributes (read once via `host.getAttribute()`, not reactive properties) can be declared with `@attribute`/`@attr` JSDoc tags. Tools like `cem lsp` (editor autocomplete) and `cem mcp` (AI agent context) work out of the box; see `CONTRIBUTING.md` for setup and the JSDoc contract, and [ADR 0013](adr/0013-cem-plugin-for-le-truc-factory-pattern.md) for design details.

### Changed

- **`@zeix/cause-effect` upgraded to `^1.4.0`** from `^1.3.4`: adds `EffectConvergenceError` (thrown when state mutations in effects do not converge within 1000 iterations) and `InvalidStoreMutationError` (thrown when directly mutating a store proxy — use `.add()`, `.set()`, `.update()`, `.remove()` methods instead), both re-exported from Le Truc's `index.ts`.
- **Package distribution overhauled** (`package.json`): the published entry point is now the *unminified* ESM bundle `index.js` (your bundler minifies anyway; readable source improves debugging), an explicit `exports` map replaces `main`/`module`, and TypeScript is now an optional peer dependency. **Migration:** deep imports into package internals no longer resolve — use named imports from the package root. If your toolchain read the removed `module` field, use the `"bun"` exports condition or the bundled `index.js`. If you consumed the removed `index.dev.js`, build from `index.ts` with `process.env.DEV_MODE` defined to `"true"` instead.

### Fixed

- **`requestContext` no longer permanently locks in the fallback when the provider connects late**: previously a single synchronous `ContextRequestEvent` at factory-run time decided the value forever — if the provider upgraded later (bundle ordering, code splitting, deferred script), the consumer served the `fallback` with no recovery. The request is now retried on a microtask and once more after the ~200 ms dependency-resolution window, and the returned signal switches to the provider's live value when it answers. **Type change**: the return type widens from `Memo<T>` to `Signal<T>` — source-compatible for all existing read-only usage. If no provider answers within ~210 ms, the fallback stays (with a `DEV_MODE` warning). See [ADR 0015](adr/0015-late-provider-retry-in-requestcontext.md).
- **Collection changes no longer rebuild every surviving element's scope in `each()`, `pass()` with Memo targets, and per-element `on()`**: one element entering or leaving a `Memo<Element[]>` collection previously tore down and recreated the scopes of *all* elements — detaching/re-attaching listeners and re-running child effects, O(n) churn per mutation. Scopes are now keyed by element identity: only entering elements get a new scope, only leaving elements are disposed, and a pure reorder creates and disposes nothing. See [ADR 0014](adr/0014-keyed-per-element-scopes-for-memo-collections.md).
- **`isSafeURL` now strips the full C0 control range before the scheme check**: the 2.1.0 hardening stripped only tab/newline/CR/FF/VT, so a URL like `\x01javascript:alert(1)` still passed and executed once the browser dropped the control character. The strip now covers `\x00`–`\x20`.

### Deprecated

- **`pass()` property-key and bare-writable-signal short forms**: `pass(child, { value: 'value' })` and `pass(child, { value: someState })` handed the child unrestricted `.set()` access to parent-owned state, with no chokepoint for the parent to validate or veto writes. Both forms now emit a `DEV_MODE` deprecation warning and are removed in the next major. **Migration** (behavior-preserving): use `() => host.value` for read-only access, or `{ get: parentSignal.get, set: parentSignal.set }` to keep writes mediated. See [ADR 0012](adr/0012-deprecate-unrestricted-write-short-forms-in-pass.md).

## 2.1.0

### Added

- **`sanitize` option on `DangerouslyBindInnerHTMLOptions`, with `TrustedHTML` support**: `dangerouslyBindInnerHTML(element, { sanitize })` accepts a `sanitize?: (html: string) => string | TrustedHTML` hook applied to the HTML immediately before it is assigned to `innerHTML` — the supported chokepoint for wiring in an external sanitizer (e.g. DOMPurify); Le Truc ships no sanitizer of its own. Returning a `TrustedHTML` (e.g. DOMPurify configured with `RETURN_TRUSTED_TYPE: true`, or `window.trustedTypes.createPolicy(...).createHTML(...)`) makes the assignment succeed on a page enforcing `Content-Security-Policy: require-trusted-types-for 'script'` — without it, the DOM rejects a plain string there no matter how thoroughly it was sanitized. The reset/clear path (`nil`, and the empty-`html` branch of `ok`) no longer touches `innerHTML` at all: it now uses `element.replaceChildren()` (or `shadowRoot.replaceChildren(document.createElement('slot'))`), so clearing content never hits the Trusted-Types sink and needs no `sanitize` hook — and, like the non-empty write, it is scheduled through the same per-element `schedule()` dedup, so a reset can no longer be silently clobbered by an earlier-scheduled, now-stale write in the same animation frame (or vice versa). `TrustedHTML` is a module-private `object` type in `src/bindings.ts`, used only to type the `sanitize` hook's return value — it is not exported, since no consumer benefits from importing Le Truc's copy (producing a real `TrustedHTML` always requires the consumer's own typing for `window.trustedTypes`, which satisfies this union regardless of whether Le Truc names or exports its own copy). It is typed as plain `object` rather than a `{ toJSON(): string }` mirror: DOMPurify's real `TrustedHTML` (resolved via its `@types/trusted-types` optional dependency) is a nominal class with only private members, by design, so it has no public `toJSON` and is not assignable to a structural mirror — `object` is the loosest type that accepts both that nominal value and a hand-rolled `{ toJSON(): string }` producer. `SCRIPT_ATTRS` (consulted when `allowScripts: true` re-executes `<script>` elements) now also allows `nonce`. The JSDoc on `dangerouslyBindInnerHTML` now states plainly that `allowScripts: false` does **not** make untrusted HTML safe — `innerHTML` fires event-handler attributes on non-`<script>` elements (`<img onerror>`, `<svg onload>`) regardless of that flag — and that all content must be trusted or sanitized upstream. See [ADR 0010](adr/0010-trusted-types-support-via-sanitize-hook.md).
- **Real DOMPurify integration test for the `sanitize` hook**: `dompurify` added as a devDependency (test-only — not bundled; the library still ships no sanitizer) backing a new `audit-dompurify` test component (`examples/test/audit/test-audit.ts`) and Playwright assertions (`examples/test/audit/test-sanitize-tt.spec.ts`) that exercise real DOMPurify with `RETURN_TRUSTED_TYPE: true` under Trusted-Types enforcement, in both Chromium and WebKit. Previously the "canonical" DOMPurify pattern above was only documented, never tested against the real library — this is what caught the `RETURN_TRUSTED_HTML`/`RETURN_TRUSTED_TYPE` naming error and the `TrustedHTML` type mismatch described above. See [ADR 0010](adr/0010-trusted-types-support-via-sanitize-hook.md).

### Changed

- **`asBoolean()` opt-out is now case-insensitive**: `attr="FALSE"` / `attr="False"` now evaluate to `false`, matching the previously-exact-only `attr="false"`. Brings `asBoolean` in line with standard HTML attribute case-insensitivity and the case-insensitive `asEnum`/hex-integer parsing already used elsewhere in the library, and lets ARIA-style string-boolean attributes (e.g. `aria-hidden="FALSE"`) convert to their logical boolean value as authors expect. **Breaking change**: any code relying on `attr="FALSE"`/`attr="False"` evaluating to `true` will now see `false`.
- **`@zeix/cause-effect` upgraded to `^1.3.4`** from `^1.3.3`: adds `DuplicateKeyError` (thrown by `createList`/`createCollection` when a generated item key collides with one already present) and `PromiseValueError` (thrown when a synchronous `Memo`/`Slot` callback returns a `Promise` — use an async callback to create a `Task` instead), both now re-exported from Le Truc's `index.ts` alongside the rest of the Cause & Effect re-exports.

### Fixed

- **`DEV_MODE` no longer evaluates to a truthy string in non-build runtimes**: `src/util.ts`'s `const DEV_MODE = typeof process !== 'undefined' && process.env.DEV_MODE` returned `process.env.DEV_MODE` as-is (`&&` returns its right operand) — a string, never a boolean — so the string `"false"` evaluated truthy and enabled dev-mode warning/logging branches. Shipped production bundles were unaffected (`build:prod` replaces the whole expression via `bun build --define process.env.DEV_MODE=false`), but every other runtime — `bun test` (no define applied), a consumer bundler that doesn't apply the define, or `process.env.DEV_MODE` literally set to the string `'false'` — got dev-mode behavior in what should have been a production build. Now compared with strict equality: `process.env.DEV_MODE === 'true'`.
- **`isSafeURL` no longer allows internal-whitespace scheme bypasses or protocol-relative URLs**: the URL-scheme check only stripped leading/trailing whitespace before testing for `javascript:`/`data:`/`vbscript:`, so a scheme containing an internal tab or newline (`java\tscript:alert(1)`, `java\nscript:alert(1)`) survived the check — browsers ignore internal whitespace when parsing a URL scheme and execute it anyway. Protocol-relative (`//evil.com`) and backslash-prefixed (`\\evil.com`, `/\evil.com`) URLs also passed through unchecked, since they contain no `://` and fell through to the permissive default. `isSafeURL` now strips all ASCII whitespace (not just the edges) before the scheme check and explicitly rejects protocol-relative/backslash-prefixed values. This is the primary XSS surface reachable through `bindAttribute`/`safeSetAttribute` (`href`, `src`, `formaction`, etc. bound to attacker-influenced values), and the bypasses were exploitable in shipped production code, not just dev builds.
- **`InvalidPropertyNameError` is now actually thrown for reserved property names**: the error class existed and was exported, but nothing in `#initSignals` ever threw it — `ReservedWords` (`constructor`, `__proto__`, `prototype`, `toString`, …) was a type-level exclusion only, unenforced at runtime. A reactive property name that defeated the type check (e.g. a `__proto__` or `constructor` key surviving from `asJSON`-parsed input, or a `Record<string, …>` cast) reached `Object.defineProperty(this, key, …)`, risking prototype-chain corruption. `#initSignals` now checks every prop against a runtime reserved-words set before `createReactiveProperty` and throws `InvalidPropertyNameError` naming the component and the offending property — checked *before* the existing `prop in this` guard, since every reserved word is an inherited `Object` builtin and would otherwise be silently skipped by that guard instead of rejected. **Breaking change**: a component that was, until now, silently accepting a reserved-word prop name will throw on connect.
- **Reconnecting a component no longer leaks the previous activation's effects and listeners**: `connectedCallback` re-ran `runSetup()` on reconnect (e.g. after reparenting or re-slotting) without first invoking the prior `#cleanup`, so every connect/disconnect cycle re-added delegated event listeners, accumulated `pass()` slot-restore closures, accumulated `each()` per-element scopes, and left stale `provideContexts` `context-request` listeners attached — a monotonically worsening leak for any component moved around the DOM. `connectedCallback` now runs the previous `#cleanup` before re-running setup on a reconnect.
- **A throwing scheduled task or throttled callback no longer aborts the rest of the animation frame**: `runTasks()` called each per-element task and each throttled callback with no error boundary, so a single throw (e.g. from a `dangerouslyBindInnerHTML`/`bindAttribute` write, or a throttled passive-event callback) skipped every later task/callback scheduled for the same frame. Each call is now wrapped in its own `try`/`catch` and logged via `console.error('[le-truc scheduler]', …)`, so one failure no longer drops the rest of the frame's work.
- **A throwing context-provider getter no longer escapes into the consumer's `Memo` unattributed**: `provideContexts`'s listener called `callback(() => host[context])` directly; if the host's getter threw, the exception surfaced inside the *consumer's* `Memo.get()`, with nothing pointing back to the provider that actually failed. The getter is now wrapped in `try`/`catch` — on a throw it logs `'provideContexts: getter threw'` with the host's element name under `DEV_MODE` and returns `undefined` to the consumer instead of propagating.
- **`asJSON` strips `__proto__`/`constructor` keys from parsed output**: defense-in-depth alongside the `InvalidPropertyNameError` enforcement above — a `JSON.parse` reviver now drops any key matching the same reserved-words set used by `#initSignals`, at every nesting level (not just the top level), so a crafted JSON payload can't plant an own `__proto__`/`constructor` property that later reaches `Object.defineProperty` on a host.
- **`all()` now fails fast on a malformed selector instead of silently stalling reactivity**: a malformed CSS selector passed to `all(selector)` made `node.matches(selector)` throw `SyntaxError` inside the underlying `Memo`'s `MutationObserver` callback — which browsers are required to swallow silently per spec — so the memo simply stopped invalidating on later mutations, with no signal that anything was wrong. `createElementsMemo` now runs one `parent.querySelector(selector)` at memo-creation time, before the `MutationObserver` is wired up, and throws the new `InvalidSelectorError` (naming the selector and the parent — component, shadow root, or document) if it's malformed. **Behavior change**: a malformed selector now throws synchronously at the `all()` call site instead of silently going stale later.
- **`pass()` now throws `InvalidPassPropertyError` instead of silently failing**: previously, passing a property that didn't exist on the target, couldn't be resolved to a signal, or wasn't Slot-backed (the target is a non-Le-Truc custom element — Lit, FAST, vanilla Web Components — or the property is read-only/computed) only logged a `DEV_MODE` warning and otherwise did nothing. Every property listed in a `pass()` call is a declared intent to bind a live signal, so a failure now throws `InvalidPassPropertyError` naming every prop that couldn't be bound and why — validated eagerly before any signal is swapped, so a failure never leaves a partial bind. See [ADR 0011](adr/0011-throw-on-pass-binding-failure.md). **Breaking change**: code that was passing properties to non-Le-Truc elements or read-only properties (previously a silent no-op) will now throw.

### Removed

- **`valueString` no longer re-exported from `index.ts`**: Le Truc's `@zeix/cause-effect` re-export block was resynced against the upgraded package's actual exports (see the `^1.3.4` upgrade above) and `valueString` was dropped from it. The function is unchanged and still exported directly from `@zeix/cause-effect`. **Breaking change** for code that imported `valueString` from `@zeix/le-truc` specifically — import it from `@zeix/cause-effect` instead.

## 2.0.3

### Changed

- **`@zeix/cause-effect` upgraded to `^1.3.3`**: Minor performance optimizations for composite signals (signals composed from multiple upstream sources). No API changes.

## 2.0.2

### Added

- **`createContext` helper function exported**: New public API function for creating typed context keys that can be provided and requested across the component tree.

### Fixed

- **`WatchHandlers` corrected to `SingleMatchHandlers` throughout documentation**: `CLAUDE.md`, `ARCHITECTURE.md`, and all skill references used `WatchHandlers` — a name from an earlier draft. The type exported from `@zeix/cause-effect` and re-exported by Le Truc is `SingleMatchHandlers<T>`. The documentation now also correctly lists the `stale?` branch, which fires when a `Task` signal is re-computing with a retained value (omitting it falls back to `ok`). Affected files: `CLAUDE.md`, `ARCHITECTURE.md`, `le-truc/references/effects.md`, `le-truc/references/component-model.md`, `le-truc-dev/workflows/implement-feature.md`.
- **`FactoryResult` incorrectly described as "flat array" throughout documentation**: `CLAUDE.md`, `ARCHITECTURE.md`, `le-truc/SKILL.md`, `le-truc/workflows/build.md`, and `le-truc/references/component-model.md` all described the factory return value as a "flat array of effect descriptors". The actual type is `Array<EffectDescriptor | FactoryResult | Falsy>` — nested arrays are recursively flattened by `activateResult()`, and falsy values (`false`, `null`, `undefined`, `''`, `0`) are filtered before activation. The `element && [watch(...)]` pattern depends on this: the inner `[watch(...)]` is a nested `FactoryResult`, not an `EffectDescriptor`. The code has always worked this way; only the documentation was wrong.
- **`SlotDescriptor` added as allowed in `PassedProps`**: `le-truc/references/coordination.md`, `le-truc/references/effects.md` updated to clarify its purpose as bi-directional adapters.
- **`le-truc-dev` `source-map` `effects.ts` exports corrected**: Listed `WatchHandlers` as an export of `src/effects.ts`. The actual exported type names are `WatchHelper` (the bound `watch` function type) and `PassHelper` (the bound `pass` function type).
- **`all()` documented as single-argument in skill files**: `le-truc/references/component-model.md`, `le-truc/references/coordination.md`, and `le-truc-dev/references/cause-effect-integration.md` all showed `all(selector)` with one argument, omitting the optional `required?` second parameter. When `required` is a non-empty string and no elements match the selector at query time, `all()` throws `MissingElementError` — the same guard `first(selector, required?)` already supported and documented. The signatures now correctly read `all(selector, required?)`.
- **`docs-server-dev` `architecture` effects table stale**: `mdMirrorEffect` (outputs `docs/**/*.md` — one parallel Markdown mirror per HTML page) and `llmsManifestEffect` (outputs `docs/llms.txt` — the AI crawler manifest) were missing from the effects table; build orchestration count read 11 instead of 13. The stale claim that "all HTML routes support `Accept: text/markdown`" — a dynamic header approach superseded by the parallel static file system — has been replaced: `mdMirrorEffect` generates static `.md` files served directly at the same path with a `.md` extension, no special route handling needed.

### Changed

- **`changelog-keeper` `adding_entries`**: The git diff command now includes `.vibe/skills/` alongside `src/` and `index.ts`. Changes to skills are treated as significant as source code changes — skills govern how code is generated and reviewed. The `entry_style` section now includes guidance on classifying and writing entries for skill changes (Changed/Added/Removed, bold skill name + affected file, describe behavioral difference).
- **`tech-writer` scope extended to skills and `server/SERVER.md`**: The skill previously covered only `docs-src/pages/`, `README.md`, `ARCHITECTURE.md`, `CLAUDE.md`, and JSDoc in `src/`. It now also owns all skill files (SKILL.md, references/, workflows/) and `server/SERVER.md`. Two new workflows added: `update-skills.md` (fix inaccurate API signatures, behavior descriptions, or process steps across any skill's reference or workflow files, with explicit cross-skill propagation check) and `update-server-md.md` (update `server/SERVER.md` after dev server or build pipeline changes, with a change-type → section mapping table).

## 2.0.1

### Added

- **`ScopeOptions` and `SlotDescriptor` types re-exported from `@zeix/cause-effect`**: `ScopeOptions` is the options argument to `createScope()` (e.g. `{ root: true }` to create an unowned root scope). `SlotDescriptor<T>` is the `{ get: () => T; set?: (value: T) => void }` shape exposed by Slot signals and now accepted directly by `pass()`.

### Changed

- **`@zeix/cause-effect` upgraded to `^1.3.2`** from `^1.2.1`: adds `ScopeOptions` for root-scope creation, `SlotDescriptor<T>` for the Slot getter/setter descriptor shape, and fixes stale reactive properties after a component reconnects to the DOM.
- **`DangerouslySetInnerHTMLOptions` renamed to `DangerouslyBindInnerHTMLOptions`**: The old name is no longer exported. Update all import sites that reference the type by name. The rename aligns with the `dangerouslyBindInnerHTML` function name and the broader `bind*` helper naming convention. **Breaking change for TypeScript consumers who import the type explicitly.**
- **`PassedProps<P, Q>` accepts `SlotDescriptor<Q[K] & {}>` values**: In addition to `Reactive<Q[K], P>`, each entry in the map passed to `pass()` may now be a raw `SlotDescriptor` — a `{ get, set? }` object. `toSignal()` detects descriptor objects (present `get`, absent `Symbol.toStringTag`) and passes them through without wrapping, so callers can forward a Slot signal's own descriptor directly.

### Fixed

- **Scope disposal bug when `connectedCallback` fires inside a re-runnable effect (regression from v0.16.3)**: The v2.0 rewrite dropped the `unown()` guard that had been present since v0.16.3. As a result, `createScope(() => activateResult(result))` in `connectedCallback` registered the component scope as a child of whatever `createEffect` was running when the element was inserted into the DOM — typically a `watch(list.keys(), …)` DOM-reconciliation effect. When that effect re-ran (e.g. because a second item was added to the list), `runCleanup` disposed all owned scopes, silently killing every `createEffect`-backed `watch` inside the newly-connected component. Event listeners added by `on()` survived (their cleanup is not auto-registered via `createEffect`), which masked the bug: clicks could still update list state through the slot setter, but the component's own reactive effects no longer responded to signal changes. Fixed by restoring `createScope(…, { root: true })` so the component scope is never owned by an outer reactive context and `disconnectedCallback` remains the sole lifecycle authority.
- **Double initialization guard in `connectedCallback`**: The factory function is now called only once per element instance. A private `#initialized` flag and `#setup` cache are set after the first `connectedCallback` run. Subsequent calls (DOM re-insertion) skip the factory entirely and re-activate the cached `FactoryResult` directly, preventing duplicate `expose()` calls and redundant reactive-property and accessor creation on reconnect.
- **`on()` event listeners now owned by a child `createScope()`**: Previously, `on()` returned a raw cleanup function from the `EffectDescriptor` thunk; cleanup was composed into the surrounding reactive scope only if the descriptor was not inside a conditional expression. Both delegation-style (`Memo<E[]>`) and direct single-element `on()` calls now wrap listener registration in `createScope()`, so the listener's cleanup is registered in the reactive ownership graph unconditionally. Listeners are guaranteed to be removed when the component's root scope disposes on `disconnectedCallback`.

## 2.0.0

### Added

- **`FactoryContext<P>` type**: Context object passed to the factory function. Contains element query helpers (`first`, `all`), the `host` element, and effect helpers (`expose`, `watch`, `on`, `pass`, `provideContexts`, `requestContext`).
- **`EffectDescriptor` type**: Deferred effect — a thunk `() => MaybeCleanup` activated inside a reactive scope after dependency resolution. Replaces `Effect<P, E>`.
- **`FactoryResult` type**: Return type of the factory function — a (possibly nested) array of `EffectDescriptor` values and falsy guards, enabling the `element && [watch(...)]` conditional pattern.
- **`PassedProps<P, Q>` type**: Second argument to `pass()` — maps child component property names to reactive values from the parent.
- **`SingleMatchHandlers<T>` type** (re-exported from `@zeix/cause-effect`): Match-branch handlers accepted by `watch()` and the `bindAttribute`, `bindStyle`, and `dangerouslyBindInnerHTML` helpers. `ok` receives the resolved value; `err` receives a single `Error`; `stale` fires when a `Task` is re-executing with a retained value (omitting it falls back to `ok`). Routing precedence: `nil` > `err` > `stale` > `ok`. All handler return types are `MaybePromise<MaybeCleanup>`.
- **`MaybePromise<T>` type** (re-exported from `@zeix/cause-effect`): `T | Promise<T>`.
- **DOM binding helpers**, each used as the second argument to `watch()`:
  - `bindText(element, preserveComments?)` — sets text content
  - `bindProperty(element, key)` — sets a DOM property
  - `bindClass<T = boolean>(element, token)` — toggles a CSS class token; generic `T` allows non-boolean reactive values without a transform
  - `bindVisible<T = boolean>(element)` — controls visibility via `el.hidden = !value`; `true` = visible
  - `bindAttribute(element, name, allowUnsafe?)` — returns `SingleMatchHandlers<string | boolean>`; boolean values use `toggleAttribute`; nil removes the attribute
  - `bindStyle(element, prop)` — returns `SingleMatchHandlers<string>`; nil removes the inline style, restoring the CSS cascade
  - `dangerouslyBindInnerHTML(element, options?)` — returns `SingleMatchHandlers<string>` for innerHTML with optional shadow DOM and script re-execution
- **`each(memo, callback)` function**: Creates per-element reactive effects from a `Memo<E[]>`. Effects for entering elements are activated in a per-element scope; leaving elements dispose their scope. The callback receives a single element and returns a `FactoryResult` or a single `EffectDescriptor`. Not part of `FactoryContext` — import directly alongside `defineComponent`.
- **`OnEventHandler<P, Evt, E>` type**: Handler signature for `on()` — receives `(event, element)` and may return `{ prop: value }` to batch-update host properties, `Promise<void>` for fire-and-forget side effects, or `void`.
- **`asClampedInteger(min?, max?)` parser**: Clamps a parsed integer to `[min, max]`; returns `min` (default `0`) when the attribute is absent or the value is out of range.
- **`throttle(fn, signal?)` utility**: Wraps any function to execute at most once per animation frame, always using the latest arguments. The returned function has a `.cancel()` method. Accepts an optional `AbortSignal` — when it fires, any pending invocation is cancelled.
- **`escapeHTML(text)`, `safeSetAttribute(element, name, value)`, `setTextPreservingComments(element, text)` utilities**: Exported for use in component code that manipulates the DOM directly. `safeSetAttribute` validates URL protocols and blocks `on*` attribute names.

### Changed

- **`defineComponent()` signature changed to a 2-parameter factory form**: The old 4-parameter signature `(name, props, select, setup)` is removed. The only form is now `defineComponent<P>(name, factory)`, where the factory receives a `FactoryContext<P>` and returns a `FactoryResult` array of `EffectDescriptor`s. **Breaking change** — all components must be rewritten.
- **Reactive properties declared via `expose()` inside the factory**: `expose(props)` is called once inside the factory at connect time to initialize reactive properties. Replaces the `props` parameter and `select` query builder from the old form.
- **`Parser<T>` signature simplified**: Parsers no longer receive the element or UI object. The signature is now `(value: string | null | undefined) => T`. Migrate existing 2-argument parsers to the new signature and brand with `asParser()`.
- **`Reactive<T>` type simplified**: Element type parameter removed; thunks are now `() => T | Promise<T> | null | undefined` instead of `(target: E) => T | null | undefined`.
- **Effect factory functions replaced by `watch()` + binding helpers**: `setAttribute`, `toggleClass`, `setProperty`, `setText`, and other v1 effect factories are removed. Use `watch(source, bindText(el))`, `watch(source, bindAttribute(el, 'name'))`, etc. instead.
- **`on()` redesigned as a factory context helper**: Takes an explicit single element or `Memo<E[]>` as the first argument. Handlers receive `(event, element)` — typed to the matched element, eliminating `event.target` casting. Returning `{ prop: value }` batch-applies updates to host properties synchronously; `Promise<void>` is supported for fire-and-forget side effects. For `Memo<E[]>` targets, uses event delegation; non-bubbling events (`focus`, `blur`, `scroll`, `mouseenter`, `mouseleave`, etc.) fall back to per-element listeners with a DEV_MODE warning pointing toward `each()` + `on()`. Passive events (`scroll`, `resize`, `wheel`, `touchstart`, `touchmove`) are throttled to one call per animation frame.
- **`pass()` redesigned as a factory context helper**: `pass(target, props)` accepts a single element or `Memo<E[]>` and returns an `EffectDescriptor`. For `Memo<E[]>` targets, manages per-element signal swap lifecycle automatically.
- **`provideContexts()` and `requestContext()` are factory context helpers**: Both are bound to the host element and called directly from the factory. `provideContexts([...])` returns an `EffectDescriptor` to include in the return array.
- **`@zeix/cause-effect` upgraded to `^1.2.1`**: Adds `SingleMatchHandlers<T>` with a single-signal `match(signal, handlers)` overload (`ok` receives the value directly, `err` a single `Error`), async handlers (`MaybePromise<MaybeCleanup>`) across all branches, and the `stale` branch for `Task` signals. Also exports `isSignalOfType<T>()` (replaces deprecated `isObjectOfType()`), `DEEP_EQUALITY`, and `DEFAULT_EQUALITY`; all re-exported from Le Truc's `index.ts`.

### Fixed

- **`extractAttributes` ReDoS**: Replaced `/\[[^\]]*\]/g` with a linear O(n) depth-counter scan, eliminating O(n²) backtracking on selectors containing many `[` without a closing `]`. Also fixed attribute name extraction to split on `]` before stripping non-alphanumeric characters, preventing characters after `]` (e.g. `#id` in `.nav[aria-expanded]#id`) from leaking into the extracted name.

### Removed

- **Old 4-parameter `defineComponent()` form** `(name, props, select, setup)` — fully replaced by the factory form.
- **`Effects<P, U>` return type and the effect-object pattern** — setup no longer returns a record keyed by UI element names.
- **Effect factory functions** (`setAttribute`, `toggleClass`, `setProperty`, `setText`, etc.) — replaced by `watch()` + `bind*` helpers.
- **`Effect<P, E>`, `ElementEffects<P, E>`, `ElementUpdater<E, T>` types** — replaced by `EffectDescriptor`.
- **`Reader<T, H>`, `LooseReader<T>`, `Fallback<T>`, `ParserOrFallback<T>` types and `isReader()`, `read()` functions** — removed from the parsers API.
- **`ComponentSetup<P, U>`, `ComponentUI<P, U>`, `Component<P>` types** — no longer needed with the factory form.
- **`InvalidEffectsError` and `InvalidUIKeyError` error classes** — removed.
- **`UI` type and `runEffects()` export** — removed.
- **`createEventsSensor(element, init, events)` function**: Use `createState(init)` + `expose({ prop: state.get })` + `on(element, 'eventType', () => { state.set(newValue) })` instead. `createSensor` is still re-exported from `@zeix/cause-effect` for advanced use cases.
- **`SensorEventHandler<T, Evt, E>` and `EventHandlers<T, E>` types** — removed along with `createEventsSensor`.

## 1.0.1

### Changed

- **`@zeix/cause-effect` upgraded from `^1.0.0` to `^1.0.2`**: Documentation and JSDoc corrections across `Sensor`, `Memo`, `Store`, `List`, `Collection`, and utility types. New `List.replace(key, value)` method updates the value of an existing item in place, propagating to all subscribers regardless of how they subscribed. No breaking changes.
- **TypeScript peer dependency broadened to `>=5.8.0`**: Le Truc now supports TypeScript 5.8 through 6 and beyond. The `@types/bun` dev dependency has been replaced with `bun-types`, and `"types": ["bun-types"]` has been added to `tsconfig.json` to fix module resolution under TypeScript 6.

### Fixed

- **`DEV_MODE` no longer throws a `ReferenceError` when bundled from source without `--define`**: `process.env.DEV_MODE` is now guarded with `typeof process !== 'undefined'`, so bundlers that consume `index.ts` directly (via the `module` field) get `false` at runtime rather than crashing. Bundlers that do define `process.env.DEV_MODE=false` still tree-shake the dead code as before.

### Added

- **Five Claude Code skills for structured AI assistance**: `le-truc` (component authoring guidance with progressive disclosure), `le-truc-dev` (library internals and API development), `docs-server-dev` (docs build pipeline and Markdoc), `tech-writer` (keeping docs in sync with source), and `changelog-keeper` (maintaining CHANGELOG.md). Each skill ships with curated references and workflow prompts under `skills/<name>/`.

## 1.0.0

### Changed

- **`@zeix/cause-effect` upgraded from `^0.18.5` to `^1.0.0`**.
- **`UI` type now includes `| undefined` in its index signature**: `type UI = Record<string, Element | Memo<Element[]> | undefined>`. This is a breaking change for TypeScript consumers who access component UI values without narrowing — index access on a `UI`-typed object now yields `Element | Memo<Element[]> | undefined` rather than `Element | Memo<Element[]>`. Component UI types with optional elements should declare them as `prop?: ElementType | undefined` (rather than `prop?: ElementType`) to satisfy `exactOptionalPropertyTypes`.

## 0.16.3

### Added

- **New re-exports from `@zeix/cause-effect`**: `createSignal`, `unown`, `untrack`, `isObjectOfType`, `SKIP_EQUALITY`, and error classes `ReadonlySignalError`, `RequiredOwnerError`, `UnsetSignalValueError` — previously omitted from Le Truc's public API surface.

### Changed

- **`@zeix/cause-effect` upgraded to `0.18.5`**: Adds `unown()` and fixes a scope disposal bug in components connected inside re-runnable effects (see Fixed below).
- **`form-checkbox`, `form-radiogroup`, and `form-spinbutton` examples updated**: All three examples now support controlled component usage, accepting externally managed state in addition to their built-in uncontrolled behaviour.

### Fixed

- **Scope disposal bug when `connectedCallback` fires inside a re-runnable effect**: `createScope` inside a reactive effect (e.g. a list-sync effect) registered its dispose on that effect's cleanup list. When the effect re-ran — for example because a `MutationObserver` fired — it disposed all child scopes including those of already-connected components, silently removing their live event listeners and reactive subscriptions. Fixed by wrapping the `connectedCallback` body in `unown()`, detaching each component's scope from the surrounding effect's ownership tree so effect re-runs no longer dispose it.

## 0.16.2

### Added

- **`asParser(fn)`**: Brands a custom parser with `PARSER_BRAND` so `isParser()` can identify it reliably regardless of `function.length`. Use this for any custom two-argument parser (especially those using default parameters or destructuring).
- **`asMethod(fn)`**: Brands a side-effect initializer with `METHOD_BRAND`, producing a `MethodProducer` that `defineComponent` dispatches explicitly rather than treating as a `Reader`.
- **`isMethodProducer(value)`**: Type guard that checks for `METHOD_BRAND`. Replaces the old implicit `isFunction` fallback for method producers.

### Changed

- **`isParser()` checks `PARSER_BRAND` first**: Falls back to `fn.length >= 2` for backward compatibility, but emits a `console.warn` in `DEV_MODE` when the fallback path is taken. Migrate custom parsers to `asParser()` to silence the warning.
- **`defineComponent` signal dispatch is explicit**: Initialization order is now `Parser → MethodProducer → Reader → static/Signal`. Previously, method producers and readers were both handled by an `isFunction` branch with no distinction.
- **`on()` and `pass()` wrap their body in `createScope()`**: Both effects now own a reactive scope internally. This ensures proper child-effect disposal and signal restoration when the component disconnects, without requiring callers to manage scopes.
- **`pass()` captures and restores the original Slot signal on cleanup**: When the parent disconnects, the child's Slot is restored to the signal it held before `pass()` ran, so the child regains its own independent state after detachment.
- **`pass()` is scoped to Le Truc components only**: The `[Reactive, callback]` two-way binding form has been removed from `PassedProp`. For non-Le Truc custom elements, use `setProperty()` instead.
- **`RESET` sentinel replaced by `undefined`**: `resolveReactive()` now returns `undefined` on error. `updateElement` treats `undefined` the same way it treated `RESET` — restoring the original DOM fallback value.
- **`resolveReactive()` warns on missing property names in `DEV_MODE`**: When a string reactive refers to a property that does not exist on the host, a `console.warn` is emitted. This catches typos for JavaScript consumers not covered by TypeScript's `keyof P` guard.
- **`EventHandler` type is now documented**: JSDoc on `EventHandler` explains both the side-effect-only (`void`) and property-update-shortcut (`{ prop: value }`) return modes. `on()` JSDoc includes `@example` blocks for both forms.

### Fixed

- **`pass()` no longer silently drops bindings on child detach**: The original Slot signal is captured before replacement and restored on cleanup, preventing stale parent signals from persisting in detached children.
- **`pass()` warns in `DEV_MODE` when target property is not Slot-backed**: Emits `console.warn` and skips the binding (instead of silently doing nothing) when `pass()` is used on a non-Le Truc element.
- **`MethodProducer` cleanup correctly composed with effect cleanup**: Cleanup functions returned by method producers are now composed with the surrounding effect cleanup in `defineComponent`, preventing disposal leaks.

## 0.16.1

### Changed

- **`createElementsMemo` mutation filtering**: The `MutationObserver` callback now uses a `couldMatch` helper to filter mutations, only invalidating when added/removed nodes match or contain matches for the selector. This prevents spurious effect re-runs caused by mutations _inside_ matched elements (e.g., `innerHTML` changes on option buttons).
- **`createElementsMemo` custom `equals`**: The memo now compares arrays by element identity (`length` + `every`).
- **Effect system simplified**: `runEffects` now uses `createScope()` to own all child effects. Dynamic collections are handled by a single `createEffect()` whose ownership graph automatically disposes per-element effects on re-run. The former `runElementsEffects` and `runElementEffects` helpers have been inlined.

### Removed

- **`runEffects` and `runElementEffects` removed from public API**: These were never intended for userland use and calling them directly could corrupt disposal. `runEffects` remains as internal helper.

### Fixed

- **`innerHTML` on matched elements no longer destroys reactivity**: Setting `innerHTML` on elements matched by `createElementsMemo` (e.g., `button[role="option"]`) previously caused the `MutationObserver` to fire spuriously, re-running and disposing effects without properly re-attaching them. Fixed by combining mutation filtering with ownership-based cleanup.

## 0.16.0

### Added

- **`createElementsMemo(parent, selector)`**: New function returning a `Memo<E[]>` of elements matching a CSS selector, backed by a lazy `MutationObserver` that activates only when read from within a reactive effect.
- **`createEventsSensor(init, key, events)`**: New function producing an event-driven `Sensor` from transformed event data, replacing the old Le Truc-specific `createSensor`.
- **New re-exports from `@zeix/cause-effect` v0.18**: `createCollection`, `createList`, `createMemo`, `createMutableSignal`, `createScope`, `createSensor`, `createTask`, `createStore`, `match`, and their associated types and type guards.
- **New type exports**: `MethodProducer`, `ContextCallback`, `UpdateOperation`, `SensorEventHandler`, `AllElements`, `FirstElement`, `ElementFromSelector`, and CSS selector type utilities (`ElementFromSingleSelector`, `ElementsFromSelectorArray`, `ExtractRightmostSelector`, `ExtractTag`, `KnownTag`, `SplitByComma`, `TrimWhitespace`).
- **`MaybeSignal<T>`** now accepts `TaskCallback<T>`, enabling async task-based property initializers.

### Changed

- **`@zeix/cause-effect` upgraded from `^0.16.1` to `^0.18.3`**. This drives most API changes below.
- **Element queries use `Memo<E[]>` instead of `Collection<E>`**: The `all()` query helper returns `Memo<ElementFromSelector<S>[]>`. The `UI` type is now `Record<string, Element | Memo<Element[]>>`.
- **`pass()` effect rewritten to use Slot signals**: Uses `getSignals()` and `slot.replace()` instead of overwriting property descriptors. Works regardless of descriptor configurability and avoids state leaks on cleanup.
- **`requestContext` returns `Memo<T>`** instead of `Computed<T>`.
- **Component property accessors use Slot signals**: `#setAccessor` in `defineComponent` now uses `createSlot` for mutable signals, with `slot.replace()` for signal swapping.
- **`Computed` renamed to `Memo`** and **`ComputedCallback` renamed to `MemoCallback`** in type signatures (from upstream `cause-effect` v0.18).
- **`updateElement`**: The unset sentinel changed from `UNSET` to `null`.
- **Eliminated `index.dev.ts`**: Both `index.js` (minified) and `index.dev.js` (unminified) are now built from the single `index.ts` entry point.

### Removed

- **`src/signals/collection.ts`**: The Le Truc-specific `Collection` signal type with `MutationObserver`, `Proxy`, and add/remove listeners has been removed. Element collection functionality is replaced by `createElementsMemo`. `Collection` is now re-exported from `cause-effect` (a different, upstream type).
- **`src/signals/sensor.ts`**: The Le Truc-specific `createSensor` and `SensorEvents` type have been removed, replaced by `createEventsSensor` and the upstream `createSensor` from `cause-effect`.
- **Removed re-exports**: `diff`, `resolve`, `toError`, `toSignal`, `UNSET`, `isAbortError`, `isNumber`, `isRecordOrArray`, `isString`, `isSymbol`, `Computed`, `ComputedCallback`, `DiffResult`, `ResolveResult`, `StoreKeyExistsError`, `StoreKeyRangeError`, `StoreKeyReadonlyError`.

### Fixed

- **`pass()` no longer requires `configurable` property descriptors** on the target element and no longer leaks state on cleanup.
- **`pass()` now warns in dev mode** when a property doesn't exist on the target (likely a typo) or has no Slot (non-Le Truc element), instead of silently doing nothing.
- **`dangerouslyBindInnerHTML` script cloning** now copies all functional and security-hardening attributes (`src`, `async`, `defer`, `nomodule`, `crossorigin`, `integrity`, `referrerpolicy`, `fetchpriority`) instead of only `type`. External scripts with `src` no longer become empty inline scripts.
- **`createEventsSensor` now reacts to collection changes**: For `Memo`-backed element collections, `getTarget()` reads the current elements on each event instead of a stale snapshot captured at sensor creation time. Static single-element targets use a fast path with no array overhead.
- **Dependency resolution no longer swallows errors silently**: `DependencyTimeoutError` is now logged via `console.warn` in dev mode. Previously, the `.catch` handler discarded all errors without any output.
- **Dependency resolution filters out already-defined components**: A microtask defer before `Promise.race` filters out components that were defined synchronously after queries ran (e.g. co-bundled components), avoiding unnecessary waits.
- **Dependency timeout increased from 50ms to 200ms**: Now that structural (CSS-only) custom elements and co-bundled components are filtered out, the timeout only applies to genuinely pending async dependencies and gives them a more realistic window.
- **`module-dialog` effect cleanup** no longer resets `host.open` to `false`, which was causing all dialog tests to fail.
- **`form-listbox` keyboard navigation** now uses direct `querySelectorAll` instead of a watched `Memo` that never activated its `MutationObserver` outside reactive contexts.

## 0.15.0

Baseline version. Changes before this version are not documented.
