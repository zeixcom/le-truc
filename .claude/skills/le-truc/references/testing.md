<overview>
Framework-agnostic testing patterns for Le Truc components.
Do not assume a specific test runner, assertion library, or browser automation tool.
</overview>

## What to test

### 1. Progressive enhancement — initial state from DOM

Verify the component reads its initial values from the DOM markup, not just from JS or attributes.

```
Given: <my-counter><button type="button">+ <span>42</span></button></my-counter>
When: the component upgrades
Then: host.count === 42, the span still shows "42"
```

### 2. Attribute → prop parsing

Verify each parser-initialised prop:

- Attribute present with a valid value → correct typed prop value
- Attribute absent → fallback value (default)
- Boolean attribute present → `true`; absent → `false`; set to `"false"` → `false`
- Enum attribute with an unrecognised value → first (default) enum value
- Attribute changed after connect → prop updates, DOM updates

### 3. Prop → DOM reactivity

Verify that setting a prop programmatically triggers the expected DOM update:

```
Given: the component is connected
When: host.label = 'New label'
Then: the label element's text content becomes "New label"
```

Test each reactive prop / effect pair independently.

### 4. User interaction → prop → DOM

Verify the full round-trip for interactive components:

```
Given: host.count === 0
When: the increment button is clicked
Then: host.count === 1 AND the count span shows "1"
```

Use real DOM events (`click()`, `input` events, `change` events). Do not mock event dispatch.

### 5. Readonly (sensor) props

Readonly props cannot be set programmatically — they are driven by DOM events. Test them by simulating the native interaction:

```
Given: <form-checkbox><label><input type="checkbox"/></label></form-checkbox>
When: the input is clicked (change event fires)
Then: host.checked === true, host has the "checked" attribute
```

Do not test `element.checked = true` directly for sensor props — they ignore programmatic assignment by design.

### 6. Multiple independent instances

Verify that two instances of the same component in the same document have independent state:

```
Given: two <basic-counter> elements with different initial counts (42 and 0)
When: the first button is clicked
Then: first counter increments, second counter is unchanged
```

### 7. Attribute synchronisation

When a reactive state is mirrored to a host attribute (via `toggleAttribute` or `setAttribute`), verify the round-trip:

```
Given: host.disabled = false (no "disabled" attribute)
When: host.disabled = true
Then: host.hasAttribute('disabled') === true

When: host.disabled = false again
Then: host.hasAttribute('disabled') === false
```

### 8. Optional vs. required descendants

Required descendants (those where `first(selector, errorMessage)` is called): the component should log a `MissingElementError` (or equivalent) when missing.

Optional descendants: the component should degrade gracefully — no error, reduced functionality.

## What not to test

- Internal signal state directly (test observable behavior: DOM, attributes, dispatched events)
- Implementation details of which effect was used
- Mock component behavior — test real components in a real DOM

## Property types: readonly vs. writable

Check the component's `Props` type before writing tests:

```typescript
type FormCheckboxProps = {
  readonly checked: boolean  // sensor-driven: test via DOM events only
  label: string              // writable: test both programmatic set and DOM event
}
```

- `readonly` props → test via native user interaction
- Writable props → test both: `element.prop = value` and via interaction

## Advice on test structure

Each component's example `.html` file already contains representative instances (default state, variants, states). Use these directly as test fixtures — they exercise the same markup the component is documented to support.

Group tests by behavior, not by file:
- "reads initial state from DOM"
- "responds to attribute changes"
- "increments on click"
- "syncs attribute on prop change"
- "handles multiple instances independently"
