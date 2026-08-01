### Module Ticker

A live market data table that updates every 10 milliseconds. It demonstrates Le Truc's fine-grained reactivity at frame-rate scale, using virtualized row blocks to stay fast.

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
- optional
- Button that toggles `running`; text is set to "Pause" or "Resume" reactively
---
- `basic-button.add-rows`
- `HTMLElement`
- optional
- Button that appends a block of new rows
---
- `template`
- `HTMLTemplateElement`
- optional
- Row template used for materializing virtualized blocks and adding new rows
---
- `tr[data-symbol]`
- `HTMLTableRowElement`
- required
- One row per ticker symbol; must contain `.price`, `.change`, and `.volume` cells
{% /table %}
