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
attribute at connect time → parser → host.prop (signal)
                                            ↓
event / property set ───────────→ host.prop (signal)
                                            ↓
                            watch(source, handler) re-runs
                                            ↓
                                  DOM update via bind*
                                            ↓
                        on(el, type, handler) → { prop: value }
                                            ↓
                             signal updated → watch re-runs
```

Check each link in order:

**Attribute → signal (connect time only):**
- Parsers in `expose()` are called **once** at connect time. Attribute changes after connect do NOT re-run parsers — there is no `observedAttributes`. If a prop must update on attribute change, it needs to be driven by events or external property sets.
- Is the attribute name exactly matching the prop name passed to `expose()`?

**Signal → `watch`:**
- Is the source of `watch()` correct? A string prop name looks up `host[name]`; a thunk tracks all signals read inside it; a `Signal` is used directly.
- Is the `watch()` descriptor included in the return array? Descriptors not in the array are never activated.
- For `all(selector)` targets with `each()`: confirm the selector is correct and the MutationObserver fires for the relevant mutations.

**`watch` → DOM:**
- Is the right `bind*` helper or custom handler used? `bindProperty` for IDL attributes, `bindText` for text content, `bindAttribute` for HTML attributes.
- Does `undefined` from a thunk source restore the original DOM value? (This is correct behavior — see references/component-model.md.)
- Is an optional element guarded with `el && watch(...)`? A missing guard causes `watch` to fail on null.

**Event handler → signal:**
- Does the `on()` handler return a property update object `{ prop: value }`? If it returns `void`, the update must be done manually (e.g., `host.count++` directly).
- Is the handler attached to the correct target element?
- For read-only event-driven props: expose `state.get` (not the full `State`), and update the value in an `on()` handler. Consumers can read the prop but cannot set it.

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
