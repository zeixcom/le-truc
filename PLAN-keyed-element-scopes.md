# PLAN: Keyed per-element scopes for `each()`, `pass(Memo)`, and non-bubbling `on()`

## Goal

Stop tearing down and rebuilding **every** per-element scope on **any** collection change in the three helpers that iterate a `Memo<Element[]>`:

- `each(memo, callback)` — `src/helpers/reactive.ts:421`
- `pass(memoTarget, props)` — Memo branch in `src/helpers/reactive.ts:395`
- `on(memoTarget, type, handler)` — non-bubbling fallback in `src/helpers/events.ts:221`

**Why this is the highest-value engineering change available:** all three wrap a `for (const el of memo.get())` loop in a `createEffect`. In `@zeix/cause-effect`, a `createScope` created inside an effect callback registers its dispose on that effect (verified in `node_modules/@zeix/cause-effect/src/graph.ts` — `registerCleanup(prevOwner, dispose)` in `createScope`'s `finally` block), and the effect runs all registered cleanups before every re-run. So when one element enters or leaves the collection, **all N elements'** scopes are disposed and recreated: event listeners detach/re-attach, `pass()` restores every child's original slot signal and re-swaps a **freshly created** computed into it (making every child's downstream effects re-run), and DEV_MODE `pass()` deprecation warnings re-fire for every element on every change.

This contradicts:
- REQUIREMENTS.md success criterion: "Le Truc proves it can scale well in complex web applications with 1000+ frequently updated elements" — today a single row insertion in a 1000-row `each()` costs O(n) scope churn.
- `.claude/skills/le-truc-dev/references/cause-effect-integration.md`, which **already claims** the fixed behavior: "creating new inner scopes for new elements and disposing scopes for removed ones" — the docs describe keyed lifecycle; the code does wholesale rebuild.
- The test suite documents the limitation explicitly: `src/tests/reactive.test.ts:608` ("elA's scope is torn down and recreated too, not just elB's").

After this change: only elements that **enter** get a new scope, only elements that **leave** get disposed, and surviving elements' scopes (listeners, slot swaps, nested effects) are untouched.

## Exact files to touch

| File | Change |
|---|---|
| `src/helpers/reactive.ts` | New internal `keyedScopes()` helper; rewrite `each()` and the Memo branch of `makePass`'s `pass()` to use it |
| `src/helpers/events.ts` | Rewrite the non-bubbling-fallback branch to use `keyedScopes()` (import from `./reactive` — same directory) |
| `src/tests/reactive.test.ts` | Flip the expectations in `describe('each — element leave/enter disposal')`; add a keyed test for `pass(Memo)` |
| `src/tests/events.test.ts` | Add a test that surviving elements keep their listener (no detach/re-attach) when the collection changes |
| `.claude/skills/le-truc-dev/references/cause-effect-integration.md` | No text change needed — the existing claim becomes true; verify wording still matches |
| `CHANGELOG.md` | Add a `### Changed`/`### Fixed` entry under `## 2.2.0 (Unreleased)` |
| `adr/` | New ADR (use the adr-keeper skill): "Keyed per-element scopes for Memo-driven collections" — records the diffing decision and the `{ root: true }` ownership mechanics |

## Step-by-step implementation plan

### Step 1 — Add the shared internal helper in `src/helpers/reactive.ts`

```ts
/**
 * Drive per-element scopes from a Memo<E[]> with element-identity keying.
 * Elements entering the collection get a scope created by `mount`; elements
 * leaving get exactly their own scope disposed. Surviving elements are
 * untouched across re-runs. All remaining scopes are disposed when the
 * enclosing owner (component scope) is disposed.
 */
const keyedScopes = <E extends object>(
	memo: Memo<E[]>,
	mount: (element: E) => MaybeCleanup,
): void => {
	const scopes = new Map<E, () => void>()
	createScope(() => {
		createEffect(() => {
			const current = memo.get()
			const currentSet = new Set(current)
			for (const [el, dispose] of Array.from(scopes)) {
				if (!currentSet.has(el)) {
					dispose()
					scopes.delete(el)
				}
			}
			for (const el of current) {
				if (scopes.has(el)) continue
				const dispose = createScope(() => mount(el), { root: true })
				scopes.set(el, dispose)
			}
		})
		return () => {
			for (const dispose of scopes.values()) dispose()
			scopes.clear()
		}
	})
}
```

Mechanics that make this correct (do not "simplify" them away):

- **`{ root: true }` is load-bearing.** Without it, each per-element scope registers its dispose on the enclosing `createEffect`, which disposes it on the next re-run — silently reproducing the old wholesale-rebuild behavior while the code *looks* keyed. `ScopeOptions.root` exists in `@zeix/cause-effect` (see `graph.ts` `createScope`).
- **The outer `createScope(...)` wrapper is load-bearing.** The descriptor body runs while the component's root scope is the active owner, so this wrapper's dispose is registered there. Its returned cleanup (`for (const dispose of scopes.values()) dispose()`) is the **only** thing that tears down still-live root-scoped element scopes on component disconnect. Without it, every `{ root: true }` scope leaks listeners/slot-swaps past `disconnectedCallback`.
- **Dispose leaving elements before mounting entering ones** — keeps the old code's teardown-before-setup ordering for elements that are replaced in one mutation.

### Step 2 — Rewrite `each()`

```ts
function each<E extends Element>(
	memo: Memo<E[]>,
	callback: (element: E) => FactoryResult | EffectDescriptor | Falsy,
): EffectDescriptor {
	return () => {
		keyedScopes(memo, element => {
			const result = callback(element)
			if (Array.isArray(result)) activateResult(result)
			else if (typeof result === 'function') result()
		})
	}
}
```

### Step 3 — Rewrite the Memo branch of `pass()`

Replace:

```ts
if (isMemo<(HTMLElement & Q)[]>(target)) {
	createEffect(() => {
		for (const el of target.get()) createScope(() => swapSlots(el, props))
	})
}
```

with:

```ts
if (isMemo<(HTMLElement & Q)[]>(target)) {
	keyedScopes(target, el => swapSlots(el, props))
}
```

`swapSlots` internally calls `createScope(...)`; inside `mount` the active owner is the `{ root: true }` element scope, so the swap's slot-restore cleanup registers there and runs exactly when that element leaves (or on component disconnect). No change to `swapSlots` itself.

### Step 4 — Rewrite the non-bubbling fallback in `src/helpers/events.ts`

First, adjust the `keyedScopes` signature from Step 1: type `mount` as `(element: E) => MaybeCleanup` instead of `(element: E) => void`. No body change is needed — `createScope(() => mount(el), { root: true })` already registers a cleanup function returned by its callback on the scope. This matters here because `attachListener` **returns** its cleanup thunk (`() => { removeEventListener; cancel }`), and the old code relied on returning it from the `createScope` callback to register it. (Its return type is mis-annotated as `EffectDescriptor` in the current code; optionally correct it to `() => void` while there.)

Then replace the `NON_BUBBLING_EVENTS` branch body (keep the DEV_MODE warning above it):

```ts
// Fall back to per-element listeners with keyed per-element lifecycle
keyedScopes(target, el => attachListener(host, el, type, handler, options))
```

Pitfall to avoid: `keyedScopes(target, el => { attachListener(...) })` — with braces and no `return`, the cleanup is discarded and listeners are never removed. The mount callback must return `attachListener`'s result.

Import `keyedScopes` in events.ts from `./reactive`. Check for import cycles: `reactive.ts` does not import from `events.ts`, so `events.ts → reactive.ts` is safe.

Note the delegation branch (bubbling events, one listener on the root) is already O(1) — leave it untouched.

### Step 5 — Update the unit tests

In `src/tests/reactive.test.ts`, `describe('each — element leave/enter disposal')`:

- First test (`disposes the per-element scope when an element leaves...`) — expectations stay identical; it should pass unchanged. If it fails, the diffing is wrong.
- Second test (currently named `keeps an element's scope behaviorally equivalent across a re-run...`): rename to something like `keeps a surviving element's scope alive when another element enters` and flip the expectations from
  `['enter:a', 'leave:a', 'enter:a', 'enter:b']` to `['enter:a', 'enter:b']`, and the post-cleanup expectation from `[..., 'leave:a', 'leave:b']` to `['enter:a', 'enter:b', 'leave:a', 'leave:b']`. Also rewrite its explanatory comment — it currently documents the rebuild behavior.
- Add a `pass(Memo)` keyed test following the same `createState<Element[]> → createMemo` pattern used there: two fake Le Truc-like targets (see existing `makePass` tests for how they seed `getSignals(target)` with `createSlot`), assert that after adding a second target, the first target's slot still holds the **same** injected signal instance (`getSignals(a).value` unchanged / no extra `slot.replace` calls — simplest observable: track `slot.current()` identity before and after the collection change; it must be `toBe`-identical).
- Add an events test in `src/tests/events.test.ts`: memo of two stub elements with spied `addEventListener`/`removeEventListener`; use a non-bubbling type (e.g. `'focus'`); after adding a third element, assert `removeEventListener` was **not** called on the surviving two and `addEventListener` was called exactly once for the new one. (DEV_MODE warning: these tests may need the same `mock.module('../util', …)` DEV_MODE handling already used in this file — copy the existing pattern.)

### Step 6 — Changelog + ADR + verification

1. Add a CHANGELOG entry under `## 2.2.0 (Unreleased)` → `### Fixed` explaining: collection changes no longer dispose/recreate scopes of surviving elements in `each()`, `pass()` with Memo targets, and per-element `on()` fallbacks; child components bound via `pass()` no longer see their slot signal replaced (and their effects re-run) when an unrelated sibling enters/leaves.
2. Create the ADR via the adr-keeper skill (status Accepted), referencing ADR 0006 (lazy Memo), ADR 0007 (deferred activation), ADR 0011 (throw semantics preserved per entering element).
3. Run: `bun test src/tests` (all 248+ tests), then `bun run test` (full Playwright suite — `module-todo`, `form-combobox`, and `module-ticker` specs exercise `each()`/`pass(Memo)` heavily), then `bun run build && bun run check:size` if the size gate from PLAN-ci-guardrails exists (this change adds ~300 B source; verify gzip stays under the ceiling).

## Edge cases a weaker model would likely miss

- **`{ root: true }` + manual Map is the entire fix.** A naive diff that still calls plain `createScope()` inside the effect will pass a superficial reading but keeps old behavior, because the effect disposes owned child scopes on every re-run. The two existing tests as-flipped will catch this — run them first.
- **Component-disconnect teardown of surviving scopes.** `{ root: true }` scopes are invisible to the ownership tree; the outer wrapper scope's returned cleanup is what disposes them on `disconnectedCallback`. Test 1's final `cleanup?.()` assertions cover this — do not delete them.
- **A throwing `mount` (ADR 0011).** `swapSlots` throws `InvalidPassPropertyError` for unbindable props. With keying, the throw now happens only for the *entering* element, inside the effect run. `createScope` re-throws (its `try/finally` has no catch), so the error still surfaces as before. Do **not** put the entry in the Map on throw — in the helper above, `scopes.set` only runs after `createScope` returns, so a throw naturally skips it. Also be aware the throw aborts mounting any *later* entering elements in the same run — identical to today's all-or-nothing behavior per ADR 0011's homogeneity argument; don't add per-element try/catch.
- **Element identity, not position, is the key.** The memo's `equals` (`a.length === b.length && a.every((el, i) => el === b[i])`) means a pure reorder *does* invalidate the memo, but with keying no scope is disposed or created (same set) — that's correct: per-element effects don't depend on position. Don't try to key by index or `data-key`.
- **Iterate a snapshot when deleting.** `for (const [el, dispose] of Array.from(scopes))` — deleting from a Map while iterating it directly is legal in JS but the snapshot makes intent unambiguous and guards against future refactors.
- **DEV_MODE `pass()` deprecation warning frequency changes** (from "every collection change × every element" to "once per entering element"). The CHANGELOG 2.2.0 Deprecated entry says "once per offending binding" — the new behavior actually *matches* the documented wording better. No doc change needed, but if a Playwright test counts console warnings, re-check it (`grep -rn "received a writable signal" examples src`).
- **`createComputed` freshness was masking staleness bugs — don't assume, verify:** previously each rebuild created fresh computeds in `toSignal`, so a thunk capturing per-call state got re-created per change. With keying, the computed for a surviving element lives longer. The thunks in all examples close over `host`/signals (live reads), so this is safe — but state this in the ADR: thunks passed to `pass()`/`watch()` must read live sources, not snapshot values (already the documented contract).
- **Do not "fix" the bubbling delegation path or single-element `pass()`** — they are already O(1)/keyless and out of scope.

## Acceptance criteria

1. `bun test src/tests` passes with the flipped expectations: adding `elB` to `[elA]` logs exactly `['enter:a', 'enter:b']` (no `leave:a`/re-`enter:a`).
2. New `pass(Memo)` test proves the surviving target's slot backing signal is **identity-stable** across a collection change.
3. New events test proves no `removeEventListener`/`addEventListener` churn on surviving elements for non-bubbling delegated fallback.
4. Disposing the component scope still tears down every live per-element scope (existing test 1 final assertion passes).
5. Full suite green: `bun run test` (unit + all Playwright example specs, especially `module-todo`, `form-combobox`, `module-ticker`).
6. `bun run build` succeeds; gzip size of `index.js` remains < 14,336 B.
7. CHANGELOG entry and new ADR exist; `cause-effect-integration.md`'s "disposing scopes for removed ones" sentence is now an accurate description of the implementation.
