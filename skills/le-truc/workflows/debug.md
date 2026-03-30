<required_reading>
1. references/component-model.md — reactivity flow and signal lifecycle
Read references/effects.md or references/parsers.md if the issue is in a specific effect or parser.
For signal-level issues (unexpected Memo/State/Sensor behavior), defer to the `cause-effect` skill.
</required_reading>

<process>
## Step 1: Understand the symptom

Ask (or infer from context):
- What is the expected behavior?
- What is the actual behavior?
- When does it happen? (on load, on attribute change, on user interaction, on child element change)

## Step 2: Locate the break in the reactivity flow

Trace the chain from trigger to DOM update:

```
attribute change  →  parser  →  host.prop (signal)
                                      ↓
                                effect reads prop
                                      ↓
                               DOM update on target
                                      ↓
                         event handler  →  { prop: value }
                                      ↓
                             signal updated  →  effect re-runs
```

Check each link in order:

**Attribute → signal:**
- Is the prop initializer a Parser (two-argument function wrapped with `asParser()`)? Only parsers are added to `observedAttributes`. A Reader (one-argument function) is called once at connect time — it does not react to attribute changes.
- Is the attribute name exactly matching the prop name?

**Signal → effect:**
- Is the prop read inside a reactive effect? A plain function that reads `host.propName` but is not inside an effect will not re-run.
- Is the effect returned from the `setup` function? Effects not returned are not registered.
- For `all(selector)` targets: the effect is wrapped in a `createEffect` that tracks the Memo — confirm the selector is correct and the MutationObserver fires for the relevant mutations.

**Effect → DOM:**
- Is the right target element named in the `setup` return? The key must match a key in the `select` return.
- Does `undefined` from a reader restore the original DOM value rather than clearing it? (This is correct behavior, not a bug — see references/component-model.md.)
- Does `null` from a reader trigger `delete` behavior (removes the attribute/style) rather than leaving the previous value?

**Event handler → signal:**
- Does the handler return a property update object `{ prop: value }`? If it returns `void`, the update must be done manually (e.g., `host.count++`).
- Is the handler attached to the correct target element (UI key)?
- For `readonly` sensor props: they cannot be set from outside (including from event handlers on other components). Use `on()` on the sensor-owning element instead.

## Step 3: Enable debug logging

Set `host.debug = true` on the component instance from the browser console or a test to get verbose per-effect logging:

```javascript
document.querySelector('my-component').debug = true
```

For project-wide enhanced error messages, build with `process.env.DEV_MODE=true`.

## Step 4: Check for known signal-level issues

If the problem is in reactive propagation itself (stale Memo values, effects not re-running, unexpected batching), defer to the `cause-effect` skill — use its `debug` workflow.

## Step 5: Check for timing issues

- **Dependency timeout**: if a required child custom element is not defined within 200ms, a `DependencyTimeoutError` is logged and effects run anyway. The DOM may not be in the expected state. Check the browser console for this error.
- **`all()` laziness**: the MutationObserver only activates when the Memo is read inside a reactive effect. If the Memo has no active readers, mutations are not tracked.

## Step 6: Fix and verify

Apply the fix. Run the project's own test suite and confirm the symptom is resolved.
</process>

<success_criteria>
- Root cause identified at the specific link in the reactivity chain that was broken
- Fix is minimal — does not change unrelated behavior
- Project test suite passes
</success_criteria>
