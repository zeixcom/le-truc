# Audit Report — @zeix/le-truc

> Source code audit conducted 2026-06-25 on branch `bugfix/code-audit-fixes` (v2.0.4, cause-effect v1.3.4). Scope: `src/` runtime + `examples/` E2E components. Unit tests: **142/142 pass**. E2E baseline: 810/810 (Chromium + WebKit) per `PROJECT_CONTEXT.md`. Every finding below was verified against the actual source unless explicitly marked *not reproduced*.

Findings are graded by **Severity** (the harm if hit) and **Likelihood** (how easily a consumer hits it):

| Grade | Severity | Meaning |
|---|---|---|
| 🔴 | Critical | Security vulnerability or always-on correctness bug |
| 🟠 | High | Likely bug / latent crash under common usage |
| 🟡 | Medium | Footgun, degradation, or correctness gap under edge conditions |
| 🔵 | Low | Robustness, docs drift, or defense-in-depth opportunity |

---

## Summary

| # | Severity | Finding | Location |
|---|---|---|---|
| 1 | 🔴 | `DEV_MODE` is a truthy string (`"false"`) in non-build runtimes → dev-mode code paths run in production | `src/util.ts:7` |
| 2 | 🔴 | `isSafeURL` allows internal-whitespace scheme bypass (`java\tscript:`) and protocol-relative URLs (`//evil.com`) | `src/bindings.ts:36-48` |
| 3 | 🟠 | `InvalidPropertyNameError` is defined & exported but **never thrown** — `ReservedWords` is type-level only; `__proto__`/`constructor` reach `Object.defineProperty` at runtime | `src/errors.ts:28`, `src/component.ts:200` |
| 4 | 🟠 | Reconnect re-activates `#setup` in a fresh scope, but the **previous scope's cleanup is overwritten without running** → effect/listener leak on repeated connect/disconnect | `src/component.ts:120-161` |
| 5 | 🟠 | `dangerouslyBindInnerHTML({allowScripts:true})` re-executes `<script>` but a non-`<script>` XSS vector in the same payload (`<img onerror>`, `<svg onload>`) is never addressed or documented | `src/bindings.ts:264-303` |
| 6 | 🟡 | Scheduler `runTasks` has no try/catch — one throwing task aborts every later task in the same frame | `src/scheduler.ts:8-16` |
| 7 | 🟡 | `extractAttributes` / `couldMatch` call `node.matches(selector)` / `querySelector(selector)` inside the MutationObserver with no guard — a malformed selector throws and silently **stalls observation** | `src/helpers/dom.ts:191-214` |
| 8 | 🟡 | `context-request` provider calls `callback(() => host[context])`; if the host property getter throws, it throws inside the *consumer's* `Memo` with no error boundary | `src/helpers/context.ts:152-164` |
| 9 | 🟡 | `asBoolean()` is case-sensitive for the opt-out: `attr="FALSE"` / `attr="False"` evaluate to **`true`** | `src/parsers/boolean.ts:13-16` |
| 10 | 🟡 | `LOG_ERROR` is referenced in docs/skills and in `AGENTS.md` but **no longer exists** in `src/util.ts` (only `LOG_WARN`) | `AGENTS.md:36`, skill files |
| 11 | 🟡 | No unit tests for `isSafeURL`, `dangerouslyBindInnerHTML`, `bindText`/`bindProperty`/`bindClass`/`bindVisible`/`bindAttribute`/`bindStyle`, `component.ts` lifecycle, `DEV_MODE` | `src/tests/*` |
| 12 | 🔵 | `createContext` is a pure type-branding cast with no runtime validation — any string is accepted as a context key | `src/helpers/context.ts:133-134` |
| 13 | 🔵 | `resolveDependencies` 200ms timeout then proceeds degraded — documented, but a still-undefined child's effects can run against a non-upgraded element | `src/helpers/dom.ts:322-357` |
| 14 | 🔵 | `pass()` to a non-Slot-backed property silently skips in production (DEV_MODE-only warning) — easy to misuse for non-Le-Truc elements | `src/helpers/reactive.ts:294-307` |
| 15 | 🔵 | `JSON.parse` objects flow into signal maps via `Object.entries` — `__proto__`/`constructor` keys in author-supplied JSON are not sanitized | `src/parsers/json.ts`, `src/component.ts:185` |

---

## 🔴 Critical

### 1. `DEV_MODE` evaluates to a truthy string in non-build runtimes

**Location:** `src/util.ts:7`
```ts
const DEV_MODE = typeof process !== 'undefined' && process.env.DEV_MODE
```

**Bug.** `&&` returns its right operand. `process.env.DEV_MODE` is a **string** (or `undefined`), never a boolean. PROJECT_CONTEXT.md and the skill docs describe it as `!!process.env.DEV_MODE`, but the code has no `!!`. Verified at runtime:

| `process.env.DEV_MODE` | expression evaluates to | truthy? |
|---|---|---|
| `undefined` (unset) | `undefined` | ✅ false |
| `"true"` | `"true"` | ✅ true (correct) |
| `"false"` | `"false"` | ⚠️ **true (WRONG)** |

**Impact.** The prod `build:prod` script uses `bun build --define process.env.DEV_MODE=false`, so the *whole* subexpression is replaced by the literal `false` in shipped bundles — **shipped production bundles are fine.** The bug bites in every other context:

- **`bun test src/tests`** runs source directly (no define). `process.env.DEV_MODE` is unset → `DEV_MODE = undefined` → dev branches **off**. So the test suite never exercises the DEV_MODE branches at all, which is why this went unnoticed.
- Any consumer importing `index.ts` (the `"module"` entry) in a bundler that does **not** apply the define, or with `process.env.DEV_MODE='false'` set in their environment, gets dev-mode logging/warnings enabled in production.
- `build:dev` sets `process.env.DEV_MODE=true` (string) via define — works by accident because `"true"` is truthy.

**Fix:** `const DEV_MODE = typeof process !== 'undefined' && process.env.DEV_MODE === 'true'` (or `!!` and ensure the build define emits a boolean literal). Add a unit test asserting `DEV_MODE === false` when the env is `'false'`.

---

### 2. `isSafeURL` scheme-bypass and protocol-relative-URL holes

**Location:** `src/bindings.ts:36-48`

```ts
const isSafeURL = (value: string): boolean => {
    if (/^(javascript|data|vbscript):/i.test(value)) return false
    if (/^(mailto|tel):/i.test(value)) return true
    if (value.includes('://')) { /* URL().protocol allowlist */ }
    return true   // ← everything else allowed by default
}
```

`safeSetAttribute` calls `value = String(value).trim()` first, which rescues leading/trailing-whitespace `javascript:`. Verified remaining bypasses (all return `true` = allowed):

| Input | Why it bypasses | Browser behavior |
|---|---|---|
| `java\tscript:alert(1)` | internal **tab** defeats the `^javascript:` regex; `.trim()` only strips edge whitespace | browsers strip internal tab/newline in URL schemes → **executes** |
| `java\nscript:alert(1)` | internal **newline** — same | **executes** |
| `//evil.com/x` | contains no `://`, so skips the `URL()` branch; falls to `return true` | protocol-relative → loads attacker origin |
| `/\evil.com` | no `://` | backslash path quirks |

**Impact.** `bindAttribute` routes string values through `safeSetAttribute` unless `allowUnsafe: true`. Any component binding an attacker-influenced value to `href`, `src`, `xlink:href`, `formaction`, `data`, etc. can be turned into a `javascript:` or off-origin execution/redirect. This is the primary XSS surface of the library and it is defeatable.

**Fix:** canonicalize before checking — strip ALL ASCII whitespace (including tab/newline/CR) not just edges, e.g. `value = String(value).replace(/[\t\n\r]/g, '').trim()`; and reject protocol-relative URLs (`/^\/\//`) or, better, parse with `new URL(value, base)` and allowlist the resulting protocol. Add unit tests for every bypass above (currently `isSafeURL` has **zero** direct unit tests).

---

## 🟠 High

### 3. `InvalidPropertyNameError` is dead code — `ReservedWords` is unenforced at runtime

**Location:** `src/errors.ts:28` (defined, exported), `src/types.ts:30-42` (type-level only), `src/component.ts:185-222` (no guard)

`grep -n InvalidPropertyNameError src/` → only the class definition and its export. It is **never thrown.** `ReservedWords` (`constructor`, `prototype`, `__proto__`, `toString`, `valueOf`, `hasOwnProperty`, …) is an `Exclude` at the type level, but `#initSignals` / `#setAccessor` do `Object.entries(instanceProps)` → `Object.defineProperty(this, key, …)` with no runtime check. A consumer that defeats the type check (e.g. `asJSON`-parsed JSON with a `__proto__` or `constructor` key, or a `Record<string,…>` cast) reaches `defineProperty(this, '__proto__', …)` / `defineProperty(this, 'constructor', …)`.

**Impact.** Defining `__proto__` or `constructor` as an own property on the host can corrupt the prototype chain or shadow builtins used internally. Low likelihood from hand-written components, higher from JSON-driven props. The error class and the JSDoc promise ("must not be used") exist but the enforcement is missing — a clear intent-vs-implementation gap.

**Fix:** In `#initSignals`, before `createReactiveProperty`, check `if (RESERVED.has(prop)) throw new InvalidPropertyNameError(host.localName, prop, …)` where `RESERVED` is a runtime `Set<string>` mirroring the `ReservedWords` type. Export it from `types.ts`.

---

### 4. Reconnect overwrites the previous scope's cleanup → effect/listener leak

**Location:** `src/component.ts:120-161`

```ts
connectedCallback() {
    const runSetup = () => {
        this.#cleanup = createScope(() => { activateResult(this.#setup) }, { root: true })
    }
    if (this.#initialized) {
        runSetup()           // ← overwrites #cleanup WITHOUT calling the previous one
    } else { /* first connect */ }
}
disconnectedCallback() {
    if (isFunction(this.#cleanup)) this.#cleanup()
}
```

When an already-initialized element is disconnected then **re-connected**, `connectedCallback` runs `runSetup()` again, assigning a brand-new cleanup to `this.#cleanup`. The *previous* cleanup (scope disposal for the prior activation — event listeners via `on()`, `pass()` slot restores, `provideContexts` listener removal, `each()` per-element scopes) is **never called.**

**Impact.** For a component that is moved in the DOM (e.g. reparented, or re-slotted) — a common pattern — every connect/disconnect cycle:
- re-adds all delegated/per-element event listeners (the old ones stay attached to the previous root or host),
- accumulates `pass()` slot swaps whose restore-cleanups never run,
- accumulates `each()` per-element scopes,
- leaves `provideContexts` `context-request` listeners attached.

This is a memory + double-firing leak that worsens monotonically. It is "high" not "critical" only because it requires repeated connect/disconnect; but reparenting/re-slotting is mainstream.

**Fix:** Before reassigning, run the prior cleanup: `if (isFunction(this.#cleanup)) this.#cleanup()` at the top of `runSetup()` (or gate it on `this.#initialized` inside `connectedCallback`). Add an E2E/unit test that moves an element between two parents N times and asserts listener count / signal-map size stays bounded.

---

### 5. `dangerouslyBindInnerHTML({allowScripts:true})` ignores non-`<script>` XSS vectors

**Location:** `src/bindings.ts:264-303`

When `allowScripts` is true, the code re-executes `<script>` elements by cloning them with a `SCRIPT_ATTRS` allowlist (`type, src, async, defer, nomodule, crossorigin, integrity, referrerpolicy, fetchpriority`). But the payload is first assigned with `target.innerHTML = html`, and `innerHTML` assignment **does** fire event-handler attributes on non-script elements even though it does not execute inline `<script>`. So an attacker payload like `<img src=x onerror=alert(1)>` or `<svg onload=alert(1)>` executes regardless of the `allowScripts` flag, and the function's name/JSDoc ("Only use with trusted or sanitized content") understates that **`allowScripts:false` does NOT make untrusted HTML safe** — `innerHTML` itself is the XSS vector.

Additionally, the `SCRIPT_ATTRS` allowlist omits `nonce` and `type=module` semantics are only partially handled (no re-execution distinction for classic vs module).

**Impact.** A consumer reading "allowScripts controls script execution" may reasonably believe `allowScripts:false` + `escapeHTML`-free HTML is safe for semi-untrusted input. It is not. The library ships no sanitizer.

**Fix:** (a) Strengthen the JSDoc to state explicitly that **all** content passed to `dangerouslyBindInnerHTML` must be trusted or sanitized upstream regardless of `allowScripts`, and that `allowScripts` only governs inline-`<script>` re-execution. (b) Optionally add a `sanitize` hook option. (c) Add unit tests asserting `<img onerror>` survives with `allowScripts:false`. (d) Consider documenting a recommended sanitizer (DOMPurify) in the security example.

---

## 🟡 Medium

### 6. Scheduler has no error isolation — one throwing task aborts the rest of the frame

**Location:** `src/scheduler.ts:8-16`

```ts
const runTasks = () => {
    requestId = undefined
    const elements = Array.from(objects)
    objects.clear()
    for (const element of elements) tasks.get(element)?.()   // no try/catch
    const callbacks = Array.from(throttledCallbacks)
    throttledCallbacks.clear()
    for (const cb of callbacks) cb()                          // no try/catch
}
```

If any scheduled task (e.g. `dangerouslyBindInnerHTML`'s `target.innerHTML = html` with a getter that throws) or throttled callback throws, the exception propagates out of `runTasks` and **every later task/callback in the same RAF frame is skipped.** Because `requestId` was already cleared, the next `schedule()`/`throttle()` will re-arm, so it's not a permanent stall — but it silently drops a whole frame of work and the error surfaces only as an uncaught exception in RAF.

**Fix:** wrap each task/callback call in `try/catch` and log via `console[LOG_WARN]`/`console.error`. Add a unit test where the first of two tasks throws and asserts the second still runs.

---

### 7. Malformed selector throws inside MutationObserver and stalls observation

**Location:** `src/helpers/dom.ts:191-214`

```ts
const couldMatch = (node: Node) =>
    node instanceof Element && (node.matches(selector) || node.querySelector(selector))
const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) { if (maybeDirty(mutation)) { invalidate(); return } }
})
```

`selector` is author-supplied via `all(selector)`. A malformed selector (e.g. containing an unbalanced bracket, or `:has()`-style pseudo that `matches` rejects) makes `node.matches(selector)` **throw** `SyntaxError` inside the observer callback. Observer callbacks swallow exceptions per spec, so the throw is silently lost and **the observer effectively stops invalidating** for subsequent mutations — the memo goes stale with no signal.

**Impact.** A typo'd `all()` selector can silently break reactivity for that query. DEV_MODE gives no warning here.

**Fix:** wrap `maybeDirty`'s `couldMatch` calls in try/catch; on `SyntaxError`, either always-invalidate (safe) or log once in DEV_MODE and re-throw the selector error eagerly at `all()` call time (preferred — fail fast at query creation rather than lazily inside the observer).

---

### 8. Throwing host getter escapes the context provider into the consumer's Memo

**Location:** `src/helpers/context.ts:152-164`

The provider does `callback(() => host[context])`. The consumer wraps this in `createMemo(consumed)`. If `host[context]` is a reactive accessor whose getter throws (e.g. a reader/computed that errors, or an accessor whose underlying signal is unset), the throw happens inside the consumer's `Memo.get()` — propagating into whatever effect reads it, with no attribution to the provider.

**Impact.** Cross-component error attribution is poor; a provider bug manifests as a consumer effect failure. Low likelihood but confusing to debug.

**Fix:** wrap the getter in try/catch inside the provider callback, log in DEV_MODE with `elementName(host)` context, and return `undefined`/fallback on error. Or document that provider getters must not throw.

---

### 9. `asBoolean()` opt-out is case-sensitive — `"FALSE"` / `"False"` evaluate to `true`

**Location:** `src/parsers/boolean.ts:13-16` — `value != null && value !== 'false'`

The parser tests explicitly document this (`parsers.test.ts:34-39` asserts `parser('FALSE') === true`). So it is *intentional as tested*, but it is a footgun: a server template emitting `disabled="FALSE"` or `aria-expanded="FALSE"` (uppercase is common in some templating/serialization) silently enables the boolean instead of disabling it. Every other parser in the family is case-insensitive where it matters (`asEnum` lowercases; `asInteger` hex-detection lowercases).

**Impact.** Counterintuitive; mismatches HTML author expectations who reasonably expect case-insensitivity.

**Fix:** change to `value?.toLowerCase() !== 'false'` (case-insensitive opt-out), update the test to assert the new behavior, and note the breaking change in the CHANGELOG. (Recommend consultation — this is a behavior change.)

---

### 10. `LOG_ERROR` is referenced in docs/skills/AGENTS.md but does not exist in source

**Location:** `AGENTS.md:36` ("logged at `LOG_ERROR` level"), `.agents/skills/le-truc-dev/references/source-map.md:32`, `tech-writer` skill — vs. `src/util.ts` which only exports `LOG_WARN`.

`grep LOG_ERROR src/` → **zero** matches. The symbol was removed (or never existed) but documentation still references it. `safeSetAttribute` throws (not logs), and the scheduler/dom DEV_MODE branches use `LOG_WARN`. Consumers or contributors following the docs will look for a non-existent export.

**Impact.** Documentation drift; minor confusion.

**Fix:** replace `LOG_ERROR` references in `AGENTS.md` and skill files with `LOG_WARN` (or `console.error`), or re-introduce `LOG_ERROR` if a distinction is desired. Tech-writer skill is the right tool.

---

### 11. Test-coverage gaps (unit)

**Location:** `src/tests/*`

The unit suite (142 tests) is thin on the DOM-binding and lifecycle surface — most of that is covered only by E2E, which is slower and less precise. Specifically, **no unit tests** for:

- `isSafeURL` directly (the most security-critical function — see #2).
- `safeSetAttribute` edge cases beyond the 3 protocol blocks + `on*` + 3 allows (no empty/whitespace, no `allowUnsafe`, no non-string coercion).
- All `bind*` functions: `bindText`, `bindProperty`, `bindClass`, `bindVisible`, `bindAttribute`, `bindStyle`, `setTextPreservingComments`, `dangerouslyBindInnerHTML` (incl. `shadowRootMode`, `allowScripts`, `nil` reset).
- `component.ts` lifecycle: `defineComponent` name validation, `connectedCallback`/`disconnectedCallback`, `#initSignals` dispatch order, reconnect (#4), the `prop in this` guard.
- `DEV_MODE` value (#1) and DEV_MODE branch behavior.
- `makeOn` beyond the single async-handler test (no delegation-vs-per-element, no passive/throttle, no non-bubbling fallback).
- `makePass` real slot-swap/restore (only descriptor-return signatures tested).
- `each` element leave/enter disposal (only initial-run callbacks tested).
- `resolveDependencies` timeout path.

**Fix:** add unit tests for each bullet. These are pure-logic or stub-DOM testable and would have caught #1, #2, #4.

---

## 🔵 Low

### 12. `createContext` is an unchecked type-branding cast

**Location:** `src/helpers/context.ts:133-134` — `const createContext = <V>(key: string): Context<string, V> => key as Context<string, V>`

No runtime validation that `key` is a non-empty string or unique. Two contexts created with the same key silently collide (a provider for one satisfies requests for the other). This matches the webcomponents-cg spec's "context key is opaque" philosophy, but the library chose to constrain keys to strings, so a uniqueness/non-empty check would be cheap defense-in-depth.

**Fix:** optional — `if (!key) throw …`. Low priority.

---

### 13. `resolveDependencies` 200ms timeout proceeds against possibly-unupgraded children

**Location:** `src/helpers/dom.ts:322-357`

Documented and intentional (progressive enhancement: don't let one missing dependency block the whole component). After timeout, `callback` runs and effects activate even though a queried child custom element may still be `:not(:defined)` — so effects operate on an upgraded-but-empty or non-upgraded element. This is by design, but worth confirming no effect writes state that the child's own `connectedCallback` will then clobber when it finally upgrades (race).

**Fix:** likely none (behavior is intentional); add a note to AGENTS.md clarifying the race window. Low priority.

---

### 14. `pass()` to a non-Slot-backed property silently skips in production

**Location:** `src/helpers/reactive.ts:294-307` — warns only under `DEV_MODE` (which, per #1, may itself be wrongly on), then `continue`s.

A consumer calling `pass()` on a plain HTML element or a non-Le-Truc custom element gets no production-time feedback that the pass did nothing; they must use `setProperty()`. The DEV_MODE warning is the only signal and it's gated behind the buggy flag.

**Fix:** consider throwing (or always warning) on a non-Slot target, since `pass()` is documented as Le-Truc-only. At minimum, fix #1 so the warning is reliable.

---

### 15. `JSON.parse` output flows into signal maps via `Object.entries` — `__proto__`/`constructor` keys unsanitized

**Location:** `src/parsers/json.ts:12-29` → `src/component.ts:185` (`Object.entries(instanceProps)`)

`asJSON` returns `JSON.parse(value)` directly. `JSON.parse` itself is **not** a prototype-pollution vector (it assigns `__proto__` as an own property, not onto the prototype). However, if that parsed object is then spread/assigned into a record that reaches `Object.entries` → `#setAccessor` → `Object.defineProperty(this, '__proto__', …)`, the `__proto__` key becomes an own accessor on the host (overlapping with #3). No Le Truc internal code today does `Object.assign({}, parsed)` into the signal map, so the direct risk is low; the interaction with #3 is the real concern.

**Fix:** primarily addressed by fixing #3. Optionally, `asJSON` could strip `__proto__`/`constructor` keys from parsed output for defense-in-depth.

---

## Methodology & scope notes

- **Read in full:** every file in `src/` (component, types, errors, util, internal, scheduler, helpers/{reactive,dom,events,context}, bindings, parsers/{string,number,json,boolean}), all 9 unit-test files, and representative examples (`form/listbox`, `module/todo`, security test component, all E2E specs inventoried).
- **Verified at runtime** (not just read): #1 (DEV_MODE string value), #2 (isSafeURL bypasses survive `.trim()`), #3 (grep confirms no throw site), #10 (grep confirms no `LOG_ERROR` in src).
- **Baseline confirmed:** `bun test src/tests` → 142 pass / 0 fail / 175 expect calls.
- **Out of scope:** `server/` build pipeline, docs-src content, the `@zeix/cause-effect` dependency internals (covered by its own ADR-0015 per PROJECT_CONTEXT). The cause-effect v1.3.4 reactive-accessor change was already verified harmless in the prior session.
- **Not reproduced / needs E2E to confirm:** the exact listener-count growth of #4 across real reparenting (logic is clear from the code; an E2E assertion is the recommended fix-verification).
