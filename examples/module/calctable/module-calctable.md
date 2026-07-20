### Module Calctable

An editable calculation table: description, amount, and price/unit columns compute a per-row price, plus running totals in the footer. Demonstrates seeding a `createList()` from server-rendered `<tr data-key>` rows so `reconcile()` adopts them instead of stripping them on first run, a trailing entry row marked `data-unreconciled` (exempt from reconciliation, always stays last) that creates a new row via `list.add()` once its three fields are filled, event delegation on the container for both live `input` sync and committing `change` handling, per-row reactive DOM updates registered from inside `reconcile()`'s `bindItem` with a raw `createEffect()`, and locale-aware currency formatting configured via the `options` attribute — the same `Intl.NumberFormat` validation logic as `<basic-number>`, shared through `examples/_common/getNumberFormatter.ts`.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-calctable.html" /%}
{% /demo %}

#### Tag Name

`module-calctable`

#### Reactive Properties

None. This component owns its data internally via `createList()` and drives the DOM directly.

#### Attributes

{% table %}
- Name
- Description
---
- `lang`
- Language code to use as locale for number formatting; if omitted, inherited from ancestor elements
---
- `options`
- Options for `Intl.NumberFormat` as JSON, read once at connect time. Typically `{"style":"currency","currency":"CHF"}`; falls back to plain decimal formatting when omitted or invalid
{% /table %}

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('tbody[data-container]')`
- `HTMLElement`
- **required**
- Container for item rows; reconciled against the list keys, plus one trailing `data-unreconciled` entry row
---
- `first('template')`
- `HTMLTemplateElement`
- **required**
- Template cloned for each item row; root element receives `data-key`
---
- `first('tbody[data-container] > tr[data-unreconciled]')`
- `HTMLElement`
- **required**
- Trailing row with empty description/amount/price-per-unit inputs; a new item is added once all three are filled and a `change` event commits them
---
- `first('tfoot .amount')`
- `HTMLElement`
- **required**
- Displays the sum of all item amounts
---
- `first('tfoot .price')`
- `HTMLElement`
- **required**
- Displays the formatted sum of all item prices (`amount × pricePerUnit`)
{% /table %}

#### Row Structure

Each item row (server-rendered or cloned from `<template>`) needs three inputs identified by class, plus an element with class `price` for the computed value:

{% table %}
- Selector
- Description
---
- `input.description`
- Free-text item description
---
- `input.amount`
- Integer amount, clamped to `[0, 100]`; setting it to `0` on an existing row removes the row
---
- `input.price-per-unit`
- Price per unit, clamped to `[0, 1000]`, 2 decimal digits
---
- `.price`
- Read-only computed cell; text content is set to `amount × pricePerUnit`, formatted with the configured `Intl.NumberFormat` options
{% /table %}
