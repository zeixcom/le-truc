### Module Scrollarea

A scroll container helper that toggles overflow classes based on scroll position and content intersection.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-scrollarea.html" /%}
{% /demo %}

#### Tag Name

`module-scrollarea`

#### Reactive Properties

None. This component updates host classes based on runtime scroll/overflow state.

#### Attributes

{% table %}
* Name
* Description
---
* `orientation`
* Scroll axis mode. Use `horizontal` for left/right overflow; defaults to vertical behavior
{% /table %}

#### Descendant Elements

{% table %}
* Selector
* Type
* Required
* Description
---
* `host.firstElementChild`
* `Element`
* optional
* Observed content element used to detect overflow; without it, no effects are applied
{% /table %}
