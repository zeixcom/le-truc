### Module Scrollarea

A scroll container that tracks overflow state using `createState()` signals and a raw effect function wrapping an `IntersectionObserver`. Demonstrates defining a component with no reactive properties, building private signals inside the setup function rather than as declared properties, writing a custom effect function that returns a cleanup callback, using `batch()` to group multiple signal updates from a scroll handler, and exposing derived boolean state as component-owned custom states (`:state(overflow)`, `:state(overflow-start)`, `:state(overflow-end)`) via `bindState()` and ElementInternals.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-scrollarea.html" /%}
{% /demo %}

#### Tag Name

`module-scrollarea`

#### Reactive Properties

None. This component sets custom states (matched in CSS via `:state()`) based on runtime scroll/overflow state.

#### Attributes

{% table %}
- Name
- Description
---
- `orientation`
- Scroll axis mode. Use `horizontal` for left/right overflow; defaults to vertical behavior
{% /table %}

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `host.firstElementChild`
- `Element`
- optional
- Observed content element used to detect overflow; without it, no effects are applied
{% /table %}
