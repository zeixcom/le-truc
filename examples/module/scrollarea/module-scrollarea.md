### Module Scrollarea

A scroll container that tracks overflow state using an`IntersectionObserver`, exposing component-owned custom states (`:state(overflow)`, `:state(overflow-start)`, `:state(overflow-end)`). While content overflows, the host becomes keyboard-focusable (`tabindex="0"`) so it can be scrolled without a pointer; the attribute is removed again once overflow ends.

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
