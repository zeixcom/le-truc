### Module Calctable

An editable calculation table whose description, amount, and price/unit columns compute a per-row price plus running totals. It shows several derived, reactive values feeding a summary footer, and is the reference example for a list seeded from server args with per-field harvest ([ADR 0046](../../adr/0046-reactive-list-items-as-mount-scopes.md) s7): the client rebuilds each server-rendered row from its markup — the key from `data-key`, the three fields from their input `value` sites — and writes them back as the user types. The per-row and total prices compose `basic-number`, which formats the raw value (passed down per row) with the configured `Intl.NumberFormat` options.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-calctable.html" /%}
{% /demo %}

#### Tag Name

`module-calctable`

#### Reactive Properties

None. This component owns its data internally via `createList()` and drives the DOM through the compiled bindings.

#### Attributes

{% table %}
- Name
- Description
---
- `lang`
- Language code used as the locale for number formatting, forwarded to the composed `basic-number` elements; if omitted, defaults to `en`
---
- `options`
- Options for `Intl.NumberFormat` as JSON. Typically `{"style":"currency","currency":"CHF"}`; falls back to plain decimal formatting when omitted or invalid
{% /table %}

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `tbody[data-container]`
- `HTMLElement`
- **required**
- Container for item rows; reconciled against the list keys, plus one trailing `data-unreconciled` entry row
---
- `input.entry-description`, `input.entry-amount`, `input.entry-price`
- `HTMLInputElement`
- **required**
- The entry row's inputs; a new item is added once all three are filled and a `change` event commits them
---
- `td.amount-total`
- `HTMLElement`
- **required**
- Displays the sum of all item amounts
---
- `td.price-total`
- `HTMLElement`
- **required**
- Displays the formatted sum of all item prices (`amount × pricePerUnit`) through a composed `basic-number`
{% /table %}

#### Row Structure

Each item row (server-rendered, authored in the page, or cloned from the extracted `<template>`) needs three inputs identified by class, plus a composed `basic-number` for the computed value:

{% table %}
- Selector
- Description
---
- `input.description`
- Free-text item description; its `value` is the field's harvest site
---
- `input.amount`
- Integer amount, clamped to `[0, 100]`; its `value` is the field's harvest site, and setting it to `0` on an existing row removes the row
---
- `input.price-per-unit`
- Price per unit, clamped to `[0, 1000]`, 2 decimal digits; its `value` is the field's harvest site
---
- `basic-number`
- Read-only computed cell; the raw `amount × pricePerUnit` arrives through `truc:pass`, formatted with the configured `Intl.NumberFormat` options
{% /table %}
