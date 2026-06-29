# Documentation

**Overview:** What to document for each Le Truc component and how to structure it. Use **standard Markdown only** — no custom syntax.

---

## Document Structure

Include a section only when it applies to the component.

### Required Sections (Always Include)

**Description** — single paragraph explaining what component does and which Le Truc patterns it demonstrates.

**Tag name** — custom element tag name, formatted as inline code block.

**Descendant elements** — table listing every element component queries via `first()` or `all()`.

### Conditional Sections (Include When Applicable)

**Reactive properties** — when component has JS-accessible reactive props beyond what attributes cover.

**Attributes** — when one or more props driven by HTML attributes (parser-initialized).

**CSS classes** — when component supports modifier classes on host for visual variants.

**Methods** — when component installs imperative methods on `host` via `defineMethod()`.

**Events** — when component dispatches custom events.

---

## Section Formats

### Description

```markdown
### My Component

One paragraph. State what it does, then name the key patterns it demonstrates
(e.g., `asInteger()`, `on('click')`, `pass()`, `provideContexts`).
```

### Tag Name

```markdown
#### Tag Name

`my-component`
```

### Reactive Properties

```markdown
#### Reactive Properties

| Name | Type | Default | Description |
|---|---|---|---|
| `count` | `number` (integer) | `0` | Current count |
| `disabled` | `boolean` | `false` | Whether the control is disabled |
| `label` | `string` | `''` | Label text |
```

For readonly properties (sensor-driven):

```markdown
| `checked` | `boolean` (readonly) | `false` | Reflects checked state of native input |
```

### Attributes

```markdown
#### Attributes

| Name | Description |
|---|---|
| `disabled` | Boolean attribute; presence sets `disabled` to `true` |
| `max` | Maximum number of items (integer); default `1000` |
| `variant` | One of `"default"`, `"primary"`, `"danger"`; default `"default"` |
```

List only attributes that map to parser-initialized props (i.e., those in `expose()` with parsers).

**Note:** Attribute values read **once at connect time** — not reactive after that.

### CSS Classes

```markdown
#### CSS Classes

| Class | Description |
|---|---|
| `primary` | Applies primary action styling to the button |
| `danger` | Applies danger/destructive action styling |
| `ghost` | Transparent background with border |
```

### Descendant Elements

```markdown
#### Descendant Elements

| Selector | Type | Required | Description |
|---|---|---|---|
| `first('button')` | `HTMLButtonElement` | required | The interactive button |
| `first('span.label')` | `HTMLSpanElement` | required | Displays the label text |
| `first('span.badge')` | `HTMLSpanElement` | optional | Displays secondary count badge |
| `all('[role="option"]')` | `HTMLElement[]` | required | The list of selectable options |
```

Use `first(…)` or `all(…)` in Selector column to match the `select` function in TypeScript source. Required/optional reflects whether component logs error when element missing.

### Methods

```markdown
#### Methods

| Name | Signature | Description |
|---|---|---|
| `add` | `(process?: (item: HTMLElement) => void) => void` | Appends new item cloned from `<template>`, optionally post-processed |
| `delete` | `(key: string) => void` | Removes item by its `data-key` attribute |
```

### Events

```markdown
#### Events

| Name | Detail type | When |
|---|---|---|
| `change` | `{ value: string }` | Dispatched when selected option changes |
| `item-selected` | `{ id: string }` | Dispatched when item is activated |
```

---

## Complete Example

```markdown
### Counter Button

A button that increments a counter on click, demonstrating `on('click')` with property updates, `watch()` with `bindText()`, and `asInteger()` parser for initial value.

#### Tag Name

`counter-button`

#### Reactive Properties

| Name | Type | Default | Description |
|---|---|---|---|
| `count` | `number` (integer) | `0` | Current count value |
| `disabled` | `boolean` | `false` | Whether button is disabled |

#### Attributes

| Name | Description |
|---|---|
| `count` | Integer; initial count value (read at connect time) |
| `disabled` | Boolean attribute; presence sets `disabled` to `true` |

#### CSS Classes

| Class | Description |
|---|---|
| `primary` | Applies primary styling |
| `large` | Larger padding and font size |

#### Descendant Elements

| Selector | Type | Required | Description |
|---|---|---|---|
| `first('button')` | `HTMLButtonElement` | required | The clickable button |
| `first('span.count')` | `HTMLSpanElement` | required | Displays current count |
| `first('span.label')` | `HTMLSpanElement` | optional | Button label text |
```

---

## What NOT to Document

- Internal implementation details (signal types, effect internals)
- The `setup` function's structure (document the **interface**, not the **implementation**)
- Props that exist only for internal coordination and are not part of public API
- Private methods or properties (those not exposed via `expose()`)

---

## Type Formatting

| Type | Format |
|---|---|
| Boolean | `boolean` |
| Integer | `number` (integer) |
| Float | `number` |
| String | `string` |
| String union | `"default" \| "primary" \| "danger"` |
| Array | `string[]` |
| Object | `{ x: number; y: number }` |
| Function | `(value: string) => void` |
| Readonly | `boolean` (readonly) |

---

## Default Value Formatting

Match the actual fallback in TypeScript source:

| Initializer | Default |
|---|---|
| `asString()` | `''` |
| `asString('fallback')` | `'fallback'` |
| `asBoolean()` | `false` |
| `asInteger()` | `0` |
| `asInteger(42)` | `42` |
| `asNumber()` | `0` |
| `asEnum(['a', 'b'])` | `'a'` |
| Static `false` | `false` |
| Static `0` | `0` |
| Static `''` | `''` |
