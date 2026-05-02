# Markup

**Overview:** HTML structure for Le Truc components — progressive enhancement, semantic nesting, variant examples.

---

## Progressive Enhancement

**Core principle:** HTML must be valid and functional **before JavaScript runs**. Server-rendered markup is the initial truth.

```html
<!-- ✅ Works without JS -->
<my-button>
  <button type="button">Click me</button>
</my-button>

<!-- ✅ Attribute-driven initial state -->
<my-button disabled>
  <button type="button" disabled>Cannot click</button>
</my-button>

<!-- ❌ Empty — nothing renders before JS -->
<my-button></my-button>
```

---

## Semantic Nesting

Use **native semantic elements** inside custom elements. Avoid `<div>` or `<span>` when a semantic element exists.

| Use | Not |
|---|---|
| `<button type="button">` | `<div role="button" tabindex="0">` |
| `<input type="checkbox">` | `<div role="checkbox">` |
| `<input type="text">` | `<div role="textbox" contenteditable>` |
| `<select>` | custom `role="listbox"` (unless native insufficient) |
| `<dialog>` | `<div role="dialog">` |
| `<details>`/`<summary>` | `<div role="button" aria-expanded>` |

```html
<!-- ✅ Native semantics -->
<form-checkbox>
  <label>
    <input type="checkbox" />
    Accept terms
  </label>
</form-checkbox>

<!-- ❌ Unnecessary div -->
<form-checkbox>
  <div role="checkbox" tabindex="0">Accept terms</div>
</form-checkbox>
```

---

## Variant Examples

Provide multiple representative examples in HTML file, separated by `<hr />`:

```html
<!-- Default state -->
<my-component>
  <button type="button"><span class="label">Click me</span></button>
</my-component>

<hr />

<!-- Disabled state -->
<my-component disabled>
  <button type="button" disabled><span class="label">Disabled</span></button>
</my-component>

<hr />

<!-- Primary variant -->
<my-component class="primary">
  <button type="button"><span class="label">Primary action</span></button>
</my-component>

<hr />

<!-- With badge -->
<my-component>
  <button type="button">
    <span class="label">Notifications</span>
    <span class="badge">5</span>
  </button>
</my-component>
```

**Rules:**
- Include at least one instance per meaningful state variation
- Include at least one instance per visual variant (modifier class)
- Include at least one instance with each optional descendant
- Separate examples with `<hr />`

---

## Attribute Initialization

Parsers in `expose()` read attributes at connect time. HTML authors configure components via attributes:

```html
<!-- Boolean attribute -->
<my-component disabled></my-component>
<my-component disabled=""></my-component>
<my-component disabled="false"></my-component>  <!-- parsed as false -->

<!-- String attribute -->
<my-component label="Submit form"></my-component>

<!-- Integer attribute -->
<my-component max="100"></my-component>

<!-- Enum attribute -->
<my-component variant="primary"></my-component>

<!-- JSON attribute -->
<my-component config='{"theme":"dark","size":"large"}'></my-component>
```

**Remember:** Attribute values read **once** at connect time. Post-connect changes to attributes do NOT update props — use property interface for reactive updates.

---

## No Inline Styles or Event Handlers

```html
<!-- ❌ Inline styles -->
<my-component style="color: red"></my-component>

<!-- ❌ Inline event handlers -->
<my-component onclick="alert('clicked')"></my-component>

<!-- ✅ Use classes for styling -->
<my-component class="primary danger"></my-component>

<!-- ✅ Use declarative event binding in TS -->
<!-- on(button, 'click', handler) in factory -->
```
