### Module Calctable

An editable calculation table — description, amount, and price/unit columns compute a per-row price, plus running totals in the footer. Rows are synced via `reconcile()`; server-rendered `<tr data-key>` rows are adopted into the initial list so they aren't stripped on first run. A trailing entry row (marked `data-unreconciled`, exempt from reconciliation) creates a new row once its description, amount, and price/unit are all filled; setting an existing row's amount to 0 removes it. Currency formatting is configured via the `options` attribute, parsed the same way as `<basic-number>`.

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
