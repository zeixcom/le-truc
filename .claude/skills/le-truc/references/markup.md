<overview>
HTML structure patterns for Le Truc component example files.
These patterns apply to the `.html` file that accompanies each component.
</overview>

## Core principle: progressive enhancement

The markup must be valid and meaningful before JavaScript runs. A user with JS disabled (or before the component upgrades) should see content, not a blank element.

**What this means in practice:**
- Put real content inside the custom element: text, images, form controls
- Use native elements that work without JS: `<button>`, `<input>`, `<a>`, `<select>`
- Do not rely on JS to inject the initial visible content

```html
<!-- ✅ Good: content present in the DOM from the start -->
<basic-counter>
  <button type="button">+ <span>0</span></button>
</basic-counter>

<!-- ✗ Bad: no content until JS runs -->
<basic-counter></basic-counter>
```

## Use native semantic elements

Prefer native HTML elements over `<div>` + ARIA:

```html
<!-- ✅ Native button -->
<my-component>
  <button type="button">Submit</button>
</my-component>

<!-- ✗ Custom div with manual ARIA -->
<my-component>
  <div role="button" tabindex="0">Submit</div>
</my-component>
```

Native elements: `<button>`, `<input>`, `<label>`, `<select>`, `<textarea>`, `<dialog>`, `<details>`, `<summary>`, `<a>`, `<form>`.

## Structure of an example file

Include one `<hr />` between each distinct example. Cover:
1. **Default state** — the simplest, most common usage
2. **Each variant** — one instance per modifier class
3. **States** — disabled, loading, error, empty, selected, etc.
4. **Edge cases** — long text, missing optional elements, non-default attribute values

```html
<!-- Default example -->
<my-component>
  <button type="button"><span class="label">Default</span></button>
</my-component>

<hr />

<!-- Primary variant -->
<my-component class="primary">
  <button type="button"><span class="label">Primary</span></button>
</my-component>

<hr />

<!-- Disabled state (attribute driven) -->
<my-component disabled>
  <button type="button" disabled><span class="label">Disabled</span></button>
</my-component>
```

## Attribute-driven states

For boolean attributes, mirror the attribute on both the host and any native element that natively understands it:

```html
<!-- host has the attribute for the parser; native input also has it for pre-JS behavior -->
<form-checkbox disabled>
  <label>
    <input type="checkbox" disabled />
    <span class="label">Disabled option</span>
  </label>
</form-checkbox>
```

## Variant modifier classes

Apply variants as classes on the host element, not on inner elements:

```html
<my-button class="primary">…</my-button>
<my-button class="danger">…</my-button>
<my-button class="ghost">…</my-button>
```

## Named example instances

Give examples meaningful `id` attributes when they will be referenced in tests:

```html
<basic-counter id="zero-counter">
  <button type="button">Count: <span>0</span></button>
</basic-counter>

<basic-counter id="negative-counter">
  <button type="button">Value: <span>-5</span></button>
</basic-counter>
```

## Form elements

Native form controls inside the custom element must be wired to a `<label>`:

```html
<form-textbox>
  <label>
    Email
    <input type="email" />
  </label>
</form-textbox>
```

Or with an explicit `for`/`id` pair when the label and input are siblings:

```html
<form-textbox>
  <label for="email-input">Email</label>
  <input id="email-input" type="email" />
</form-textbox>
```

## What to avoid

- No inline styles (`style="…"`)
- No inline event handlers (`onclick="…"`)
- No `<div>` where a semantic element exists
- No empty custom elements with no descendant content
