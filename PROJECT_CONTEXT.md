# PROJECT_CONTEXT.md — Handoff for Source Code Audit

> Accumulated knowledge from the cause-effect v1.3.4 migration verification session (2026-06-24/25). Purpose: orient a separate audit session reviewing `src/` for vulnerabilities, bugs, error-prone/counterintuitive patterns, and test-coverage gaps. This is descriptive context, not findings.

## What Le Truc is

`@zeix/le-truc` is a tiny (~1 runtime dependency) library for building reactive custom elements (Web Components). Its only runtime dependency is `@zeix/cause-effect` (a signal/computed-effect library). The public API surface: `defineComponent` (factory form), parsers (`asString`, `asNumber`, `asJSON`, `asBoolean`), bindings (`bindText`, `bindProperty`, `bindClass`, `bindVisible`, `bindAttribute`, `bindStyle`, `dangerouslyBindInnerHTML`), helpers (`each`, `escapeHTML`, `safeSetAttribute`, `setProperty`, `schedule`, `throttle`), and the context protocol (`createContext`).

## Repository layout (audit-relevant)

```
src/
  component.ts        defineComponent + the Truc class (lifecycle, signal init, accessor setup)
  types.ts            Parser/MethodProducer brands, ComponentProps, ReservedWords
  errors.ts           Error classes (all custom errors)
  util.ts             DEV_MODE flag, elementName, isCustomElement, isNotYetDefinedComponent
  internal.ts         WeakMap<HTMLElement, Record<string, Signal>> — per-instance signal map
  scheduler.ts        RAF-based schedule() + throttle() (single shared RAF tick)
  helpers/
    reactive.ts       makeWatch, makePass, each, toSignal, activateResult  ← reactive core
    events.ts         makeOn (event delegation vs per-element, passive/throttle)
    dom.ts            makeElementQueries (first/all), createElementsMemo (MutationObserver), extractAttributes
    context.ts        webcomponents-cg context protocol: provideContexts / requestContext
  bindings.ts         bind* functions, safeSetAttribute, isSafeURL, escapeHTML, dangerouslyBindInnerHTML
  parsers/            string, number, json, boolean
  tests/              *.test.ts — Bun unit tests (142 tests, run via `bun test src/tests`)
examples/
  basic/, module/, layout/, test/   example components
  test/<feature>/test-*.spec.ts     Playwright e2e tests against served HTML
server/               Bun dev server + build pipeline (docs + examples)
```

## How to run tests

- **Unit tests** (pure logic, no browser): `bun test src/tests` → 142 tests.
- **E2E** (Playwright, needs `serve:examples`): `bun run test`. Config in `playwright.config.ts`. Runs 3 browser projects (Chromium → Firefox → WebKit) sequentially; `fullyParallel: true` within each. `webServer` auto-starts `bun run serve:examples` with `reuseExistingServer: true`.
- **Known environment issue (not code):** Playwright's bundled Firefox uses SWGL for headless rendering, which cannot map a framebuffer on **macOS 27 Beta 2** (`RenderCompositorSWGL failed mapping default framebuffer`). Firefox is currently commented out in `playwright.config.ts`. Chromium + WebKit run clean (810/810). Re-evaluate when Firefox runs natively on the OS, or after a Playwright upgrade.
- **Gotcha:** `reuseExistingServer: true` means a stale `bun server/serve.ts` (docs dev server, no `PLAYWRIGHT=1` build) on port 3000 will be reused by Playwright instead of starting the correct `serve:examples` build → tests silently poll against stale assets and look like hangs. Kill anything on :3000 before `bun run test`.
- **Interrupted runs leak browser processes.** `bun run test` interrupted via SIGTERM leaves orphaned `ms-playwright` Firefox/Chromium processes pegging CPU; they must be `pkill -9 -f ms-playwright` before re-running, or new browser launches time out.

## cause-effect v1.3.4 — verified, no migration needed

Two behavior changes shipped in 1.3.4 (see cause-effect ADR-0015):

1. **Composite signal accessors are now reactive.** `at()`, `byKey()`, `keyAt()`, `indexOfKey()`, and `Symbol.iterator` on List/Collection, plus `Symbol.iterator` on Store, previously created no graph edge — reading them inside an effect/memo silently failed to re-run on structural changes. Each now calls `subscribe()` (or `ensureFresh()` for `deriveCollection`).
2. **Store per-property access stays granular.** `Store.byKey()` and proxy property access (`store.prop`) deliberately remain untracked for structural changes, because proxy reads are already granular (`store.name` returns the child `State` whose `.get()` forms a property-level edge).

**Why no Le Truc code needed changing:**
- No defensive `keys()` pre-read workarounds existed (searched `defensive|workaround|pre-read|silent|no edge|untracked`).
- `examples/module/todo/module-todo.ts` uses `list.keys()` (was already reactive), `list.byKey()` inside `watch` handlers (handler body runs under `untrack()` per `reactive.ts:234`, so incidental reads stay untracked), and Store proxy `.completed`/`.label` (deliberately still granular).
- `examples/module/ticker/module-ticker.ts` reads `tickers.byKey(symbol)` inside `each()` effect — now forms a structural edge, but `tickers` is only `update()`'d in place (never restructured), so the edge never fires. `for (const key of tickers.keys())` is inside a `setInterval` (untracked context).
- `server/file-watcher.ts:69` `fileList.replace(path, info)` now reaches iterator-subscribers, but no consumer uses the List iterator; all read via `sources.get()` returning `T[]`.

**Verification:** All 142 unit tests pass; 810/810 e2e (Chromium + WebKit) pass, including every todo/each/pass/watch/context test that exercises the now-reactive accessors.

**Latent behavior change to be aware of during audit:** effects reading *only* these accessors will now re-run on structural changes where they previously went stale. Today harmless (the two example lists never restructure reactively), but any new reactive list restructuring will now behave correctly rather than silently breaking. If the audit finds a hot effect that reads these accessors in a tight loop, the new structural edge could increase re-run frequency.

## Architecture & mental model (for the auditor)

### Component lifecycle (`component.ts`)
- `defineComponent(name, factory)` validates the name (`must contain '-'`, `^[a-z][a-z0-9-]*$`), then defines a `class Truc extends HTMLElement` via `customElements.define`.
- `connectedCallback`: first connect runs the factory (building the `FactoryContext`, calling `expose()` to init signals, collecting the returned `FactoryResult`), then `resolveDependencies(runSetup)` waits for undefined custom-element children (200ms timeout, then proceeds degraded). Re-connect (if `#initialized`) just re-runs `activateResult(this.#setup)` in a fresh `createScope({ root: true })`.
- `disconnectedCallback`: calls `this.#cleanup` if it's a function. **Note:** cleanup is only assigned inside `runSetup` via `createScope`'s return — if effects never activated (e.g. empty `#setup`), `#cleanup` is `undefined` and disconnect is a no-op.
- `observedAttributes = []` always — parsers run once at connect on the current attribute; **attributes are not reactive post-connect**. To react to attribute changes, use events or `watch()`.

### Signal initialization (`#initSignals` / `#setAccessor`, `component.ts:169-222`)
- Dispatch order per initializer: **Parser** (branded) → **MethodProducer** (branded) → static/Signal/computed.
- Mutable signals are wrapped in a **Slot** so `pass()` can swap the backing signal later. Non-mutable signals (Memo/Computed) get a getter-only `Object.defineProperty`. Slot accessors also use `Object.defineProperty(this, key, slot)` where `slot` is callable.
- `prop in this` guard skips already-set properties (so explicit properties win over `expose`).
- `getSignals(this)` (`internal.ts`) lazily creates a per-instance `Record<string, Signal>` in a `WeakMap`.

### Reactive core (`helpers/reactive.ts`)
- `toSignal(host, source)` resolves a `Reactive` (string prop name | Signal | thunk | `{get,set}` SlotDescriptor) to a Signal. String lookup hits `getSignals(host)[source]`, falling back to `createMemo(() => host[source])`.
- `makeWatch`: wraps `match()` in `createEffect`. **The handler body runs inside `untrack()`** (`reactive.ts:227,234`) — only the declared source(s) trigger re-runs; incidental signal reads in the handler are NOT tracked. This is load-bearing for the todo `byKey` pattern.
- `makePass`: swaps Slot-backed signals on target Le Truc children; restores originals on cleanup. Throws `InvalidCustomElementError` if target isn't a custom element; warns in DEV_MODE if the target prop isn't Slot-backed (non-Le-Truc elements need `setProperty`). Memo targets get per-element lifecycle.
- `each(memo, callback)`: per-element scope; when elements leave the collection their effects dispose with the scope. Callback returns `FactoryResult | EffectDescriptor | Falsy`.

### Element queries (`helpers/dom.ts`)
- `first(selector)` / `all(selector)`: query `host.shadowRoot ?? host`. Undefined custom elements are collected as dependencies for `resolveDependencies`.
- `all()` returns a `Memo<E[]>` backed by `createElementsMemo` with a **lazily-activated MutationObserver** (`watched` callback): only starts observing when an effect reads the memo; disconnects when unwatched.
- Observer config: `childList: true, subtree: true`, plus `attributes` filtered by `extractAttributes(selector)` (parses `.class`, `#id`, `[attr]` from the selector). `maybeDirty` only invalidates when added/removed nodes `couldMatch` the selector (or on any attribute mutation).
- `extractAttributes` uses a linear scan (not regex) to avoid O(n²) backtracking on `[[[[`.
- `createElementsMemo` `equals`: shallow `a.length === b.length && a.every((el,i) => el===b[i])` — relies on cause-effect ≥0.18.4 respecting `equals` for `innerHTML` mutations that don't change matched elements.

### Events (`helpers/events.ts`)
- `on(target, type, handler)`: single Element → `attachListener`; `Memo<E[]>` → event delegation on `host.shadowRoot ?? host` via `composedPath()`, EXCEPT non-bubbling events (large `NON_BUBBLING_EVENTS` set) which fall back to per-element listeners with a DEV_MODE warning pointing to `each()+on()`.
- Handler return value `{ prop: value }` is `batch()`-applied to host (sync only; `Promise<void>` is fire-and-forget).
- Passive events (`PASSIVE_EVENTS`: scroll/resize/wheel/touch*) are throttled to one call per RAF via `throttle()`.

### Context (`helpers/context.ts`)
- Implements the [webcomponents-cg context spec](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md): `context-request` event (bubbles + composed), `provideContexts` attaches a listener providing `() => host[context]`, `requestContext` dispatches once and wraps the resolved getter in a `Memo`. Fallback used if no provider responds.
- `createContext<V>(key)` is a type-branding cast — no runtime validation.

### Security surface (`bindings.ts`) — **focus area for audit**
- `safeSetAttribute(element, attr, value)`: blocks `on*` attribute names (`/^on/i`), validates values via `isSafeURL`. **Throws** on violation (never silent). Used by `bindAttribute` unless `allowUnsafe: true`.
- `isSafeURL(value)`: rejects `javascript:|data:|vbscript:` schemes; allows `mailto:|tel:`; allows `://` URLs whose `URL().protocol` is `http:|https:|ftp:`; allows everything else (relative paths, fragment, etc.). **Audit question:** is the "everything else is safe" default sound? E.g. protocol-relative `//evil.com`, leading-whitespace/control-char bypasses (`value.trim()` is applied first), Unicode/Cyrillic, `data:` with mixed case already handled by `i` flag.
- `escapeHTML(text)`: escapes `& < > " '` — standard.
- `dangerouslyBindInnerHTML`: sets `innerHTML` (or `shadowRoot.innerHTML`) directly. `allowScripts: true` re-executes `<script>` by copying a hardcoded allowlist of attributes (`SCRIPT_ATTRS`) and textContent. **Audit questions:** Is the SCRIPT_ATTRS allowlist complete/appropriate (e.g. `nonce`, `type=module`)? Could `allowScripts` + attacker HTML still smuggle execution via non-`<script>` vectors (event handlers in HTML, `<iframe srcdoc>`, `<svg onload>`)? `innerHTML` itself doesn't execute `<script>` but does fire other handlers — does the docstring warn adequately?
- `bindStyle(prop)`: `el.style.setProperty(prop, value)` — `prop` is caller-supplied. CSS injection (e.g. `prop='behavior'` legacy, or `value` with `url(javascript:...)` in old IE) — mostly inert in modern browsers but worth a note.
- `setTextPreservingComments`: removes non-comment children then appends a text node — safe by construction (text node, not HTML).

### Parsers (`parsers/*`)
- All branded via `asParser` from a static fallback closure. `asJSON` (`json.ts`) `JSON.parse`s with `SyntaxError` wrapping; throws `TypeError` if both value and fallback are nullish; treats `''` as invalid. **Audit question:** prototype-pollution via `JSON.parse('{"__proto__":...}')` — does any downstream code spread/assign parsed objects into records? (`internal.ts` signal map, `#initSignals` Object.entries — `__proto__` key handling.)

### Scheduler (`scheduler.ts`)
- Single shared RAF tick (`requestTick`/`runTasks`). `schedule(key, task)` dedupes per `key` object (last task wins). `throttle(fn)` dedupes per wrapped function. `throttle().cancel()` discards pending. **Audit question:** `runTasks` iterates `Array.from(objects)` then `tasks.get(element)?.()` — if a task throws, subsequent tasks in the same frame still run (no try/catch). Is uncaught-thrown-in-RAF acceptable, or should it be guarded?

### Types & brands (`types.ts`)
- `PARSER_BRAND` / `METHOD_BRAND` symbols; `isParser`/`isMethodProducer` check brand presence. `ReservedWords` blocks `constructor`, `prototype`, `__proto__`, `toString`, etc. as prop names. **Note:** `InvalidPropertyNameError` exists in `errors.ts` but I did not find it thrown anywhere in `src/` — verify whether the ReservedWords guard is actually enforced at runtime or only at the type level (potential gap: a runtime prop name like `'constructor'` reaching `#setAccessor`/`Object.defineProperty`).

## Observed potential audit threads (not yet investigated)

These are starting points for the audit session, not confirmed issues:

1. **`InvalidPropertyNameError` appears unused.** `ReservedWords` is a type-level exclusion; confirm whether reserved/reserved-like prop names are validated at runtime in `#initSignals`/`#setAccessor`. If not, `Object.defineProperty(this, '__proto__', ...)` or `'constructor'` could be reachable.
2. **`isSafeURL` allow-by-default.** Anything not matching the three reject-regexes and not containing `://` is allowed. Review protocol-relative, whitespace/control-char, and attribute-specific (e.g. is `href`-vs-`src`-vs-`xlink:href` distinction needed?).
3. **`dangerouslyBindInnerHTML` + `allowScripts` re-execution** — SCRIPT_ATTRS allowlist completeness; non-`<script>` XSS vectors survive `innerHTML` assignment.
4. **`JSON.parse` prototype pollution** — trace whether parsed JSON objects flow into `Object.assign`/spread/record-merge paths.
5. **Scheduler uncaught exceptions** — a throwing task in `runTasks` aborts the rest of the frame's tasks.
6. **`resolveDependencies` 200ms timeout then proceeds degraded** — documented, but confirm no effect runs against a still-undefined child element in a way that corrupts state (vs. just logging).
7. **`pass()` to a non-Slot-backed property** — warns in DEV_MODE, silently skips in production. Confirm no example relies on this for a non-Le-Truc element.
8. **Reconnect re-activates `#setup`** in a fresh root scope, but the old scope's cleanup (`#cleanup`) is overwritten without being called — **possible effect/effect-listener leak on repeated connect/disconnect**. Verify `disconnectedCallback` → `#cleanup()` runs before a reconnect assigns a new `#cleanup`.
9. **MutationObserver `couldMatch`** calls `node.matches(selector)` and `node.querySelector(selector)` — `selector` is author-supplied; a malformed/very-complex selector could throw inside the observer callback (no try/catch), stalling observation.
10. **`context-request` listener** calls `callback(() => host[context])` — the getter is invoked later by the requester's `Memo`; if `host[context]` throws (e.g. a getter with side effects), it throws inside the consumer's memo. Confirm error boundaries.

## Tooling / config notes
- Runtime: Bun. Package manager: bun (lockfile `bun.lock`).
- Build: `package.json` scripts. `DEV_MODE` is `!!process.env.DEV_MODE` (`util.ts:7`) — controls enhanced errors/logging and `LOG_WARN`/`LOG_ERROR` gating. Production builds set `DEV_MODE=false` for size.
- TypeDoc generates API docs in `docs-src/api/` from source JSDoc — doc drift is a real risk if JSDoc and code diverge.
- ADRs live in `/adr/` (currently up to ADR-0009 in this repo; ADR-0015 referenced in the cause-effect changelog is in the cause-effect repo, not here).
- Current branch: `bugfix/code-audit-fixes` (this audit's natural target).

## Files already read in full this session (no need to re-read)
`src/component.ts`, `src/types.ts`, `src/errors.ts`, `src/util.ts`, `src/internal.ts`, `src/scheduler.ts`, `src/helpers/reactive.ts`, `src/helpers/dom.ts`, `src/helpers/events.ts`, `src/helpers/context.ts`, `src/bindings.ts`, `src/parsers/json.ts`, `examples/test/security/test-security.ts`, `package.json`, `playwright.config.ts`. Unit tests in `src/tests/*.test.ts` confirmed green (142/142).
