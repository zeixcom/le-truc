### Module Cem List

A server-rendered catalog of custom-element declarations. It shows a component that simply displays pre-rendered, static data.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-cem-list.html" /%}
{% /demo %}

#### Tag Name

`module-cem-list`

#### Reactive Properties

None. Filtering is implemented as local state inside the component (not an exposed prop) — see Descendant Elements below.

#### Descendant Elements

Card content is generated server-side by the `{% cem-list %}` Markdoc tag, one `card-collapsible` per custom-element declaration in the manifest, with tabs for whichever of Fields / Methods / Attributes / CSS Properties / CSS Parts / Slots are non-empty.

An optional `form-textbox` descendant (name `filter`) filters the cards live as you type: each keystroke is matched as a case-insensitive substring against every card's full text content (name, tag name, description, and members), so a search term can match on any of those.

#### Full Component Catalog

Generated live from `custom-elements.json` — every example component in this repo:

{% cem-list src="custom-elements.json" /%}
