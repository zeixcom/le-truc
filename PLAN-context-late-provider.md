# PLAN: Make `requestContext` resilient to late-connecting providers

## Goal

Today `requestContext(context, fallback)` (`src/helpers/context.ts:191-201`) dispatches a single `ContextRequestEvent` synchronously during the consumer's factory run and then **permanently** locks in whatever it got: if no ancestor provider answered at that instant, the returned `Memo<T>` serves the fallback forever.

A provider misses the request in realistic, non-buggy setups:

- The provider component's `customElements.define()` runs **after** the consumer's (module ordering in the same bundle, code-split chunk, deferred script). The provider element exists in the DOM above the consumer, but it isn't upgraded yet, so its `context-request` listener isn't attached when the consumer dispatches.
- The provider is upgraded but its own factory hasn't activated its `provideContexts` descriptor yet — descriptors activate **after dependency resolution** (ADR 0007), which involves at minimum a `queueMicrotask` and possibly a 200 ms `customElements.whenDefined()` wait (`src/helpers/dom.ts`, `DEPENDENCY_TIMEOUT`). A parent provider that queries slow children attaches its listener *later* than a fast child consumer dispatches.

The failure is silent: the consumer renders with the fallback and never recovers. This undermines M10 (Context protocol) and the progressive-enhancement story (components must degrade gracefully, then *recover*).

Fix: back the resolved getter with a reactive container and re-dispatch the request up to two more times (microtask, then after the dependency-timeout window). When a provider answers late, the consumer's Memo updates reactively — no consumer code changes.

## Exact files to touch

| File | Change |
|---|---|
| `src/helpers/context.ts` | Rewrite `makeRequestContext`; no signature change |
| `src/tests/context.test.ts` | New tests for late-provider resolution; existing tests keep passing |
| `examples/test/context/test-context.ts` + its spec | Add a late-defined-provider scenario (Playwright) |
| `ARCHITECTURE.md` | Extend the "Context Protocol" section (one sentence on retry/late binding) |
| `AGENTS.md` | Update the context-protocol bullet (currently implies one-shot resolution) |
| `CHANGELOG.md` | `### Fixed` entry under `## 2.2.0 (Unreleased)` |
| `adr/` | Amend ADR 0008 via the adr-keeper skill (add the retry decision to its Decision section, or create a small follow-up ADR — let adr-keeper's workflows decide the mechanics) |

## Step-by-step implementation plan

### Step 1 — Rewrite `makeRequestContext` in `src/helpers/context.ts`

```ts
const makeRequestContext =
	<P extends ComponentProps>(host: HTMLElement & P): RequestContextHelper =>
	<T extends {}>(context: Context<string, () => T>, fallback: T): Memo<T> => {
		// Reactive container for the resolved getter. Wrapped in an object:
		// State.set() treats a bare function argument as an updater, so a
		// getter must never be stored as a naked function value.
		const resolved = createState<{ get: () => T }>({ get: () => fallback })
		let answered = false

		const dispatch = () => {
			host.dispatchEvent(
				new ContextRequestEvent(context, (getter: () => T) => {
					answered = true
					resolved.set({ get: getter })
				}),
			)
		}

		dispatch()
		if (!answered) {
			// Retry once providers defined later in the same bundle have upgraded
			// (their define() calls run before this microtask drains) …
			queueMicrotask(() => {
				if (!answered && host.isConnected) dispatch()
			})
			// … and once more after the dependency-resolution window, for
			// providers whose own effect activation waited on whenDefined().
			setTimeout(() => {
				if (!answered && host.isConnected) {
					dispatch()
					if (!answered && DEV_MODE)
						console.warn(
							`requestContext: no provider answered for '${String(context)}' on ${elementName(host)}; using fallback`,
						)
				}
			}, 210)
		}

		return createMemo(() => resolved.get().get())
	}
```

Imports needed at the top of the file: add `createState` to the existing `@zeix/cause-effect` import (already imports `createMemo`, `createScope`, `isFunction`).

Use `210` (ms) as a named constant `CONTEXT_RETRY_DELAY` with a comment tying it to `DEPENDENCY_TIMEOUT` (200 ms) in `src/helpers/dom.ts` — retry *after* that window closes. Do not import `DEPENDENCY_TIMEOUT` from dom.ts (it isn't exported; exporting it for this would couple the modules for no gain).

### Step 2 — Understand and preserve the existing reactivity path (do not break it)

The current one-shot design is *already* reactive for value changes: the provider's callback hands over `() => host[context]`, and reading that inside the Memo's computation tracks the provider's underlying signal (property access goes through the Slot's `get`). The rewrite must preserve this: the Memo computation reads `resolved.get()` (tracks the container State) **and then calls** `.get()` (tracks the provider's signal). Both dependencies live in the same computation — late binding and live updates both propagate.

### Step 3 — Unit tests in `src/tests/context.test.ts`

Follow the file's existing patterns (`createEventListenerMap`, `mock.module('../util', …)` snapshot/restore discipline documented at the top of the file). Add:

1. **Late provider wins:** create a consumer host whose `dispatchEvent` initially reaches no listener; call `makeRequestContext(host)(ctx, 'fallback')`; read the memo inside `createScope`+`createEffect` and record values; then simulate the provider appearing (register the listener on the shared event map) and flush the microtask (`await Promise.resolve()` twice or `await new Promise(r => setTimeout(r, 0))`); assert the effect re-ran with the provider's value.
2. **Timeout retry:** provider only attaches after the microtask but before ~210 ms; use `setTimeout`-based waiting (bun test supports async tests) and assert recovery. Keep the timeout small in tests if you make `CONTEXT_RETRY_DELAY` injectable — **don't** make it injectable in the public API; a 250 ms `await` in one test is acceptable.
3. **No provider ever:** memo stays on fallback; in DEV_MODE the warning fires once (use the existing DEV_MODE mock pattern); in non-DEV it doesn't.
4. **Already-answered short-circuit:** provider present at dispatch #1 → `queueMicrotask`/`setTimeout` callbacks must not re-dispatch (spy on `host.dispatchEvent` call count: exactly 1).
5. **Disconnected host:** set `isConnected` false on the stub before the microtask fires → no re-dispatch (dispatch count 1).

Note the existing `createTestHost` stub has a no-op `dispatchEvent` returning `true` and no `isConnected` — extend the stub with `isConnected: true` where needed.

### Step 4 — Playwright coverage in `examples/test/context/`

Add a scenario where the provider element wraps the consumer in HTML, but `customElements.define()` for the provider is deliberately delayed (e.g. `setTimeout(() => defineComponent(...), 50)` in the test module, or a second test-only tag `test-context-late-provider`). Assert the consumer first shows the fallback, then updates to the provided value without user interaction. Look at `examples/test/context/test-context.ts` and its `.spec.ts` for the current provider/consumer pair and mirror their structure; run with `bun run test:component context` (check `scripts/test-component.ts` for the exact name matching it expects).

### Step 5 — Docs and changelog

- `ARCHITECTURE.md` → "Context Protocol" section: append one sentence: consumers re-dispatch the context request on a microtask and once after the 200 ms dependency window, so providers that upgrade after the consumer still bind; the Memo switches from fallback to the provided value reactively.
- `AGENTS.md` → context bullet: note that `requestContext` recovers from late-defined providers (fallback is served until then) and that after ~210 ms with no provider the fallback is permanent for that connection.
- `CHANGELOG.md` under 2.2.0 `### Fixed`, following the house style (bold summary sentence, then mechanism, then behavioral-change callout).
- ADR 0008 amendment via adr-keeper (its `update-adr.md` workflow): document the retry decision and the rejected alternative (full `subscribe: true` + ContextRoot buffering à la `@lit/context` — heavier, needs provider-side subscriber bookkeeping; the two-retry scheme covers the actual failure windows Le Truc's own lifecycle creates).

## Edge cases a weaker model would likely miss

- **`createMemo(consumed)` in the current code captures the function value once** — the obvious "fix" of just reassigning `consumed` in a later callback does nothing, because the Memo holds a reference to the *old* function. Reactivity requires the getter to live inside a signal the Memo reads. This is the core of the bug class; verify the rewrite reads the container **inside** the memo computation.
- **`State.set()` interprets a function argument as an updater** (cause-effect convention). Storing the getter as a bare function (`resolved.set(getter)`) would *call* it and store its return value. The `{ get: getter }` wrapper object is not optional styling — it is correctness.
- **`T extends {}` constraint:** cause-effect signals reject `null`/`undefined` values. The container holds an object, so this is safe regardless of `T`; don't refactor to `createState<(() => T) | undefined>(undefined)` — it violates the constraint and reintroduces the updater ambiguity.
- **Re-dispatch is safe against double answers:** providers call `e.stopImmediatePropagation()` before answering (see `makeProvideContexts`), so at most one provider answers per dispatch; a second dispatch after an answer is skipped via the `answered` flag — keep that guard so an ancestor *changing* providers doesn't flap.
- **The timers are fire-and-forget with no cleanup hook** — `requestContext` runs at factory time, outside any scope, and returns a Memo (not a descriptor), so there is nowhere to register a cancel. The `host.isConnected` guard is the substitute: a consumer disconnected before the retry does not dispatch events from a detached node (which would bubble nowhere anyway, but the guard also suppresses the DEV_MODE warning noise). Do not try to wrap this in `createScope` — there is no active owner at factory time for this call and adding one would change `expose()` semantics.
- **`Memo` laziness:** if nothing ever reads the memo, the container State still updates on late answer — harmless; no observer, no work. Don't add `watched` callbacks here.
- **Test-runner reality:** `src/tests` run in plain `bun test` without DOM (`context.test.ts` uses hand-rolled event maps, not real elements). Real `dispatchEvent` bubbling is covered only by the Playwright layer — that's why Step 4 is not optional.
- **Reconnect behavior:** on re-connect, `connectedCallback` re-activates descriptors but does **not** re-run the factory (see `#initialized` in `src/component.ts`), so `requestContext` is *not* re-dispatched on reconnect. That is pre-existing behavior; leave it, but mention it in the AGENTS.md bullet ("resolved once per component lifetime, at first connect").

## Acceptance criteria

1. `bun test src/tests` green, including the five new unit tests; the four pre-existing `makeRequestContext` tests pass **unchanged** (fallback-when-no-provider, provider-getter, etc.).
2. New Playwright late-provider spec passes: consumer shows fallback first, provider's value after the provider defines, with no interaction.
3. `host.dispatchEvent` is called exactly once when a provider answers immediately (spy-count test) — proves no gratuitous event traffic in the common case.
4. DEV_MODE-off build emits no console output for the no-provider case (existing DEV_MODE mock pattern asserts this).
5. `bun run build` passes and gzip size stays < 14,336 B (the change is ~20 lines).
6. ARCHITECTURE.md, AGENTS.md, CHANGELOG.md updated; ADR 0008 amended (or follow-up ADR created) via adr-keeper.
