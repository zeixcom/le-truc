### Module Ticker

A live market data table that updates at 10 ms intervals, demonstrating Le Truc's fine-grained reactivity at frame-rate scale. Each row is backed by an independent `State<TickerItem>` inside a closure-held `createList`. The `tick` function calls `tickers.byKey(key).update(updater)` on a random subset of symbols each interval — only those rows' `watch` effects re-run, touching only their exact DOM cells. Rows with unchanged data are never visited.

To support 10,000+ rows smoothly, the component uses block-level virtualization. An `IntersectionObserver` monitors `<tbody>` elements, replacing off-screen rows with a single height-matched placeholder. This strips DOM nodes and tears down their `watch` effects automatically via `each()`, making signal updates for virtualized rows practically free.

Open the browser inspector, enable _Highlight DOM updates_, and watch: only the price, change, and volume cells of updated rows flash. The rest of the table is untouched.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-ticker.html" /%}
{% /demo %}

#### Tag Name

`module-ticker`

#### Reactive Properties

{% table %}
* Name
* Type
* Default
* Description
---
* `running`
* `boolean`
* `true`
* Whether the live feed is active; toggled via the Pause/Resume button
---
* `fraction`
* `number`
* `0.1`
* Fraction of symbols updated per 10 ms tick (0–1); set via `fraction` attribute
{% /table %}

#### Descendant Elements

{% table %}
* Selector
* Type
* Required
* Description
---
* `basic-button.toggle`
* `HTMLElement`
* optional
* Button that toggles `running`; text is set to "Pause" or "Resume" reactively
---
* `basic-button.add-rows`
* `HTMLElement`
* optional
* Button that appends a block of new rows
---
* `template`
* `HTMLTemplateElement`
* optional
* Row template used for materializing virtualized blocks and adding new rows
---
* `tr[data-symbol]`
* `HTMLTableRowElement`
* required
* One row per ticker symbol; must contain `.price`, `.change`, and `.volume` cells
{% /table %}
