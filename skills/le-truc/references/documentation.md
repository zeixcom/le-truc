<overview>
What to document for each Le Truc component and how to structure it.
Use standard Markdown only — no Markdoc tags or custom syntax.
</overview>

## Document structure

A component documentation file uses the following sections. Include a section only when it applies to the component.

### Required sections (always include)

**Description** — a single paragraph explaining what the component does and which Le Truc patterns it demonstrates.

**Tag name** — the custom element tag name, formatted as an inline code block.

**Descendant elements** — a table listing every element the component queries via `first()` or `all()`. Required elements are essential for the component to function; optional elements unlock additional behavior.

### Conditional sections (include when applicable)

**Reactive properties** — when the component has JS-accessible reactive props beyond what attributes cover. List all props.

**Attributes** — when one or more props are driven by HTML attributes (parser-initialised). List the attribute names and behavior. This is separate from reactive properties because HTML authors set attributes; JS consumers set properties.

**CSS classes** — when the component supports modifier classes on the host for visual variants.

**Methods** — when the component installs imperative methods on `host` via `defineMethod()`.

**Events** — when the component dispatches custom events.

## Section formats

### Description

```markdown
### My Component

One paragraph. State what it does, then name the key patterns it demonstrates
(e.g., `read()` with `asInteger()`, `on('click')`, `pass()`, `provideContexts`).
```

### Tag name

```markdown
#### Tag Name

`my-component`
```

### Reactive properties

```markdown
#### Reactive Properties

| Name | Type | Default | Description |
|---|---|---|---|
| `count` | `number` (integer) | `0` | Current count |
| `disabled` | `boolean` | `false` | Whether the control is disabled |
| `label` | `string` | `''` | Label text |
```

`readonly` properties (sensor-driven) should note they cannot be set from outside:

```markdown
| `checked` | `boolean` (readonly) | `false` | Reflects the checked state of the native input |
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

List only attributes that map to parser-initialised props (i.e., the ones in `observedAttributes`).

### CSS classes

```markdown
#### CSS Classes

| Class | Description |
|---|---|
| `primary` | Applies primary action styling to the button |
| `danger` | Applies danger/destructive action styling |
| `ghost` | Transparent background with border |
```

### Descendant elements

```markdown
#### Descendant Elements

| Selector | Type | Required | Description |
|---|---|---|---|
| `first('button')` | `HTMLButtonElement` | required | The interactive button |
| `first('span.label')` | `HTMLSpanElement` | required | Displays the label text |
| `first('span.badge')` | `HTMLSpanElement` | optional | Displays a secondary count badge |
| `all('[role="option"]')` | `HTMLElement[]` | required | The list of selectable options |
```

Use `first(…)` or `all(…)` in the Selector column to match the `select` function in the TypeScript source. Required/optional reflects whether the component logs an error when the element is missing.

### Methods

```markdown
#### Methods

| Name | Signature | Description |
|---|---|---|
| `add` | `(process?: (item: HTMLElement) => void) => void` | Appends a new item cloned from the `<template>`, optionally post-processed before insert |
| `delete` | `(key: string) => void` | Removes an item by its `data-key` attribute |
```

### Events

```markdown
#### Events

| Name | Detail type | When |
|---|---|---|
| `change` | `{ value: string }` | Dispatched when the selected option changes |
| `item-selected` | `{ id: string }` | Dispatched when an item is activated |
```

## What not to document

- Internal implementation details (signal types, effect internals)
- The `setup` function's structure (document the *interface*, not the *implementation*)
- Props that exist only for internal coordination and are not part of the public API
