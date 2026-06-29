# Testing

**Overview:** Framework-agnostic testing patterns for Le Truc components. Do not assume specific test runner, assertion library, or browser automation tool.

---

## What to Test

### 1. Progressive Enhancement — Initial State from DOM

Verify component reads initial values from DOM markup, not just from JS or attributes.

```
Given: <my-counter><button type="button">+ <span>42</span></button></my-counter>
When: component upgrades
Then: host.count === 42, the span still shows "42"
```

### 2. Attribute → Prop Parsing

Verify each parser-initialized prop:

- Attribute present with valid value → correct typed prop value
- Attribute absent → fallback value (default)
- Boolean attribute present → `true`; absent → `false`; set to `"false"` → `false`
- Enum attribute with unrecognized value → first (default) enum value
- Attribute changed after connect → prop **does not** update (parsers run once)

### 3. Prop → DOM Reactivity

Verify setting prop programmatically triggers expected DOM update:

```
Given: component is connected
When: host.label = 'New label'
Then: label element's text content becomes "New label"
```

Test each reactive prop / effect pair independently.

### 4. User Interaction → Prop → DOM

Verify full round-trip for interactive components:

```
Given: host.count === 0
When: increment button is clicked
Then: host.count === 1 AND count span shows "1"
```

Use **real DOM events** (`click()`, `input` events, `change` events). Do not mock event dispatch.

### 5. Readonly (Sensor) Props

Readonly props cannot be set programmatically — driven by DOM events. Test by simulating native interaction:

```
Given: <form-checkbox><label><input type="checkbox"/></label></form-checkbox>
When: input is clicked (change event fires)
Then: host.checked === true, host has "checked" attribute
```

Do **not** test `element.checked = true` directly for sensor props — they ignore programmatic assignment by design.

### 6. Multiple Independent Instances

Verify two instances of same component in same document have independent state:

```
Given: two <basic-counter> elements with different initial counts (42 and 0)
When: first button is clicked
Then: first counter increments, second counter is unchanged
```

### 7. Attribute Synchronization

When reactive state mirrored to host attribute (via `toggleAttribute` or `setAttribute`), verify round-trip:

```
Given: host.disabled = false (no "disabled" attribute)
When: host.disabled = true
Then: host.hasAttribute('disabled') === true

When: host.disabled = false again
Then: host.hasAttribute('disabled') === false
```

### 8. Optional vs Required Descendants

- **Required descendants** (where `first(selector, errorMessage)` called): component should log `MissingElementError` (or equivalent) when missing
- **Optional descendants**: component should degrade gracefully — no error, reduced functionality

---

## What NOT to Test

- Internal signal state directly (test observable behavior: DOM, attributes, dispatched events)
- Implementation details of which effect was used
- Mock component behavior — test real components in real DOM

---

## Property Types: Readonly vs Writable

Check component's `Props` type before writing tests:

```typescript
type FormCheckboxProps = {
  readonly checked: boolean  // sensor-driven: test via DOM events only
  label: string              // writable: test both programmatic set and DOM event
}
```

- `readonly` props → test via **native user interaction**
- Writable props → test both: `element.prop = value` **and** via interaction

---

## Test Structure Advice

Each component's example `.html` file already contains representative instances (default state, variants, states). Use these **directly as test fixtures** — they exercise same markup component documented to support.

Group tests by behavior, not by file:
- "reads initial state from DOM"
- "responds to attribute changes"
- "increments on click"
- "syncs attribute on prop change"
- "handles multiple instances independently"

---

## Example Test Cases

### Counter Component

```javascript
// Progressive enhancement
{ 
  given: '<counter><button>+ <span>0</span></button></counter>',
  when: 'component upgrades',
  then: 'host.count === 0 AND span.textContent === "0"'
}

// Attribute parsing
{
  given: '<counter count="42"><button>+ <span>0</span></button></counter>',
  when: 'component upgrades',
  then: 'host.count === 42'
}

// Prop → DOM reactivity
{
  given: 'connected counter with count=0',
  when: 'host.count = 5',
  then: 'span.textContent === "5"'
}

// User interaction → prop → DOM
{
  given: 'connected counter with count=0',
  when: 'button clicked',
  then: 'host.count === 1 AND span.textContent === "1"'
}

// Multiple instances
{
  given: 'two counters with count=0 and count=10',
  when: 'first counter button clicked',
  then: 'first.count === 1 AND second.count === 10'
}
```

### Checkbox Component

```javascript
// Readonly prop via DOM event
{
  given: '<form-checkbox><input type="checkbox"/></form-checkbox>',
  when: 'input clicked (change event)',
  then: 'host.checked === true'
}

// Attribute sync
{
  given: 'checkbox with checked=false',
  when: 'host.checked = true',
  then: 'input.checked === true AND host.hasAttribute("checked") === true'
}
```

---

## Assertion Helpers

Create reusable assertion helpers for common patterns:

```javascript
// Assert DOM text content
assertTextContent(element, expected)

// Assert attribute presence/value
assertAttribute(element, name, expectedValue)
assertHasAttribute(element, name)
assertNoAttribute(element, name)

// Assert CSS class
assertHasClass(element, token)
assertNoClass(element, token)

// Assert DOM property
assertProperty(element, key, expectedValue)

// Assert event dispatched
assertEventDispatched(element, type, detailChecker)
```
