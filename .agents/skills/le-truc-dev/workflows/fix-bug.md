# Fix Bug

## Required Reading
1. references/source-map.md — locate the relevant source file(s)
2. references/non-obvious.md — many apparent bugs are documented tricky behaviors
3. Read references/cause-effect-integration.md if the issue could be in signal propagation or reactive graph behavior

## Process

### Step 1: Check Non-Obvious Behaviors First

Read references/non-obvious.md. Many apparent bugs are actually correct behavior that is surprising:

- `isParser()` checks only for `PARSER_BRAND` — unbranded functions are NOT treated as parsers
- `pass()` is Le Truc-only; using it on non-Le-Truc elements silently does nothing
- `undefined` from a reactive source restores the original DOM value — it does not clear/null it
- `all()` MutationObserver is lazy — only active when the returned `Cell` has a reactive reader
- `safeSetAttribute` throws on `on*` attribute names and unsafe URLs — it is never silent

If the symptom matches a documented behavior, explain it to the user rather than changing the code.

### Step 2: Reproduce

Identify the minimal reproduction:
- Which component setup triggers the issue?
- Which step in the reactivity chain is wrong? (attribute → parser → signal → effect → DOM → event → signal)
- Is the bug deterministic or timing-dependent?

### Step 3: Read the Relevant Source File

Use references/source-map.md to find the file. Read it fully before changing anything.

### Step 4: Trace Through the Code

For effect bugs — trace through `makeWatch` / `makeOn` / `makePass` in `src/helpers/reactive.ts` and `src/helpers/events.ts`:
- Was the helper actually called synchronously during factory/`each()` execution? (a call after an `await` or in a detached `setTimeout` throws `NoActiveCollectorError` — check for that first, it's the modern equivalent of a silently-dropped descriptor)
- If it's a hand-authored `EffectDescriptor` (not produced by `watch`/`on`/`pass`/`each`/`provideContexts`): was it registered via `watch(() => true, descriptor)`? A bare `return`ed descriptor with no internal `createEffect`/`createScope` call has its cleanup silently discarded by `activateResult()` — see non-obvious.md's hand-authored-descriptor entry
- Is the source signal correctly resolved by `toSignal()`?
- Is the `bind*` handler receiving the right element?

For parser bugs — trace through `isParser` in `src/types.ts`:
- Is the parser branded with `PARSER_BRAND`?
- Did `asParser()` get called to wrap the custom parser?

For signal propagation bugs — read references/cause-effect-integration.md, then consider escalating if the issue is in the reactive graph itself.

For timing bugs:
- Is the 200ms dependency-resolution timeout involved?
- Is the `all()` MutationObserver not yet activated?

### Step 5: Fix

Write the smallest fix. Avoid changing unrelated behavior. If the fix touches `watch`/`makeWatch` or signal lifecycle, check that the cause-effect ownership model is preserved (every `createEffect` inside a `createScope`).

### Step 6: Verify

Run the full test suite. If no test covered this bug, add one before closing.

### Step 7: Post-Task Protocol

Follow the post-task protocol defined in SKILL.md. Bug fixes do not require API review.

## Success Criteria
- Root cause identified at the specific source line
- Fix is minimal — no unrelated changes
- Non-obvious behavior documented in references/non-obvious.md if it wasn't already
- Test added for the regression
- Full test suite passes, linter clean
