# Debug Workflow

**Use when:** Diagnosing and fixing unexpected reactive behavior.

**Required reading first:**
- `references/component-model.md` — reactivity flow and signal lifecycle

Read `references/effects.md` or `references/parsers.md` if issue is in specific effect or parser.
For signal-level issues (unexpected Memo/State/Sensor behavior), defer to cause-effect documentation.

---

## Step 1: Understand the Symptom

Ask (or infer from context):
- What is the expected behavior?
- What is the actual behavior?
- When does it happen? (on load, on attribute change, on user interaction, on child element change)

---

## Step 2: Locate the Break in Reactivity Flow

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

### Attribute → Signal (connect time only)
- Parsers in `expose()` called **once** at connect time
- Attribute changes after connect do NOT re-run parsers — no `observedAttributes`
- Is attribute name exactly matching prop name passed to `expose()`?

### Signal → `watch`
- Is source of `watch()` correct? String prop name looks up `host[name]`; thunk tracks all signals read inside; `Signal` used directly
- Was `watch()` actually called during the factory run? It registers automatically when called — a call skipped by a conditional never activates
- For `all(selector)` targets with `each()`: confirm selector correct and MutationObserver fires

### `watch` → DOM
- Is right `bind*` helper or custom handler used? `bindProperty` for IDL attributes, `bindText` for text content, `bindAttribute` for HTML attributes
- Does `undefined` from thunk source restore original DOM value? (This is correct behavior)
- Is optional element guarded with `el && watch(...)`? Missing guard causes `watch` to fail on null

### Event handler → Signal
- Does `on()` handler return property update object `{ prop: value }`? If returns `void`, update must be done manually
- Is handler attached to correct target element?
- For read-only event-driven props: expose `state.get` (not full `State`), update value in `on()` handler

---

## Step 3: Enable Debug Logging

Build with `--define process.env.DEV_MODE='"true"'` (the **string** `"true"` — guards check `process.env.DEV_MODE === 'true'` inline, so a bare boolean does not enable them) for enhanced error messages, dependency-timeout warnings, and unbranded-parser warnings. `DEV_MODE` is decided at build time (or by the env var in unbundled runtimes like `bun test`), not per instance.

Within a `DEV_MODE` build, every component also gets a reactive `debug: boolean` property for free (the `debug()` extension, auto-injected — no `expose()` change needed). Set `host.debug = true` from the console, the browser's properties panel, or `metaKey`+click on the element to scope diagnostics to one instance: a pulsing host indicator on every `on()`/`pass()`/`watch()` firing, a `data-le-truc-on`/`-pass`/`-watch` marking attribute on the target element where it's knowable, and one `console.debug()` entry per firing naming the component and, for `on()`, the event type. A `watch()` handler not produced by a `bind*` helper gets no element mark — only the host-level pulse, since a wrong highlight is worse than none.

---

## Step 4: Check for Known Issues

### Dependency timeout
If required child custom element not defined within 200ms, `DependencyTimeoutError` logged and effects run anyway. DOM may not be in expected state. Check browser console.

### `all()` laziness
MutationObserver only activates when the returned `Cell` is read inside a reactive effect. If it has no active readers, mutations are not tracked.

---

## Step 5: Check for Timing Issues

- **Dependency timeout:** see Step 4
- **`all()` laziness:** see Step 4
- **Passive events:** scroll, resize, touch, wheel automatically throttled

---

## Step 6: Fix and Verify

Apply fix. Run project's test suite. Confirm symptom resolved.

---

## Success Criteria

- Root cause identified at specific link in reactivity chain that was broken
- Fix is minimal — does not change unrelated behavior
- Project test suite passes
