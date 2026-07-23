### Module Carousel

A scroll-snap carousel with dot navigation and keyboard controls. Demonstrates integrating a native browser API (`IntersectionObserver`) via `run()` — the hand-authored effect descriptor is registered so its returned cleanup actually disconnects the observer on disconnect. `index` is initialised from the slide marked `aria-current="true"` in `expose()`. The `all()` Memo targets (`dots`, `slides`, `buttons`) show how `on()` automatically iterates over dynamic element collections, and `each()` drives per-slide/per-dot `watch()` effects.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-carousel.html" /%}
{% /demo %}

#### Tag Name

`module-carousel`

#### Reactive Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `index`
- `number` (integer)
- Index of the first slide with `aria-current="true"` (fallback `0`)
- Current active slide index, clamped to valid slide range
{% /table %}

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('button.prev')`
- `HTMLButtonElement`
- **required**
- Button to navigate to the previous slide
---
- `first('button.next')`
- `HTMLButtonElement`
- **required**
- Button to navigate to the next slide
---
- `all('[role="tab"]')`
- `Memo<HTMLElement[]>`
- optional
- Dot/tab navigation elements; toggles `aria-selected` and `tabIndex`
---
- `all('[role="tabpanel"]')`
- `Memo<HTMLElement[]>`
- optional
- Slide panels; toggles `aria-current` based on `index`
---
- `all('nav button')`
- `Memo<HTMLElement[]>`
- optional
- Interactive navigation buttons handling click/keyboard events
{% /table %}
