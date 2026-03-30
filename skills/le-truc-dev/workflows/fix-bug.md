<required_reading>
1. references/source-map.md — locate the relevant source file(s)
2. references/non-obvious.md — many apparent bugs are documented tricky behaviors
Read references/cause-effect-integration.md if the issue could be in signal propagation or reactive graph behavior.
</required_reading>

<process>
## Step 1: Check non-obvious behaviors first

Read references/non-obvious.md. Many apparent bugs are actually correct behavior that is surprising:

- Parser detection falls back to `fn.length >= 2` — default params or destructuring will produce false positives/negatives
- `pass()` is Le Truc-only; using it on non-Le-Truc elements silently does nothing
- `undefined` from a reader restores the original DOM value — it does not clear/null it
- `all()` MutationObserver is lazy — only active when the Memo has a reactive reader
- `setAttribute` throws (and logs) on `on*` attribute names and unsafe URLs — it is never silent

If the symptom matches a documented behavior, explain it to the user rather than changing the code.

## Step 2: Reproduce

Identify the minimal reproduction:
- Which component setup triggers the issue?
- Which step in the reactivity chain is wrong? (attribute → parser → signal → effect → DOM → event → signal)
- Is the bug deterministic or timing-dependent?

## Step 3: Read the relevant source file

Use references/source-map.md to find the file. Read it fully before changing anything.

## Step 4: Trace through the code

For effect bugs — trace through `updateElement` in `src/effects.ts`:
- Is `fallback` captured correctly at setup time?
- Is `resolveReactive` resolving the right value?
- Is `undefined` vs `null` handling correct?

For parser bugs — trace through `isParser` in `src/parsers.ts`:
- Is the parser branded with `PARSER_BRAND`?
- Is `fn.length >= 2` reliable for this parser?

For signal propagation bugs — read references/cause-effect-integration.md, then consider escalating to the `cause-effect-dev` skill if the issue is in the reactive graph itself.

For timing bugs:
- Is the 200ms dependency-resolution timeout involved?
- Is the `all()` MutationObserver not yet activated?

## Step 5: Fix

Write the smallest fix. Avoid changing unrelated behavior. If the fix touches `updateElement` or signal lifecycle, check that the cause-effect ownership model is preserved (every `createEffect` inside a `createScope`).

## Step 6: Verify

Run the full test suite. If no test covered this bug, add one before closing.
</process>

<success_criteria>
- Root cause identified at the specific source line
- Fix is minimal — no unrelated changes
- Non-obvious behavior documented in references/non-obvious.md if it wasn't already
- Test added for the regression
- Full test suite passes
</success_criteria>
