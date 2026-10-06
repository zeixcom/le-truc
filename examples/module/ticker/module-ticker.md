### Module Ticker

A live market data table that updates every 10 milliseconds. It demonstrates Le Truc's fine-grained reactivity at frame-rate scale, using virtualized row blocks to stay fast. It is the reference example for a list harvested through a key alias ([ADR 0047](../../adr/0047-harvest-through-a-key-alias-witnessed-by-the-render.md)): the rows render only through nested block lists, and the client rebuilds the symbol list from each row's `data-key` and raw values.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-ticker.html" /%}
{% /demo %}

#### Tag Name

`module-ticker`

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `running`
- `boolean`
- `true`
- Whether the live feed is active; toggled via the Pause/Resume button
---
- `fraction`
- `number`
- `0.1`
- Fraction of symbols updated per 10 ms tick (0–1); set via `fraction` attribute
{% /table %}

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `basic-button.toggle`
- `HTMLElement`
- **required**
- Button that toggles `running`; its label is passed "⏸️ Pause" or "▶️ Resume" reactively
---
- `basic-button.add-rows`
- `HTMLElement`
- **required**
- Button that appends a block of 100 new rows
---
- `table`
- `HTMLTableElement`
- **required**
- Container for the blocks; one `<tbody>` per 100 symbols, reconciled against the block keys
{% /table %}

#### Row Structure

Each block `<tbody>` holds its rows while it is near the viewport, and a single height-matched `tr.placeholder` while it is not. Each row is keyed by its symbol and carries every field's raw value, which the client reads back at connect:

{% table %}
- Selector
- Description
---
- `tr[data-key]`
- The row; `data-key` is the symbol, `data-open` the reference price, and `data-direction` (`up`, `down`, `flat`) styles the change cell
---
- `data.price`
- The current price; `value` is the raw number, the text is formatted with two decimals
---
- `td.change`
- The change since `open`, formatted as a signed percentage
---
- `data.volume`
- The cumulative volume; `value` is the raw number, the text is formatted compactly
{% /table %}
