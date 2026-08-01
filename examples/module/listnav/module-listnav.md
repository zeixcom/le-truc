### Module Listnav

Keeps a `form-listbox` selection, the URL hash, and lazily loaded content all in sync with each other. It demonstrates coordinating multiple components together with browser navigation state.

#### Preview

{% demo %}
{{ content }}

{% sources title="Source code" src="../sources/module-listnav.html" /%}
{% /demo %}

#### Tag Name

`module-listnav`

#### Reactive Properties

None. This component coordinates child component properties and URL hash side effects.

#### Descendant Elements

{% table %}
- Selector
- Type
- Required
- Description
---
- `first('form-listbox')`
- `HTMLElement & FormListboxProps`
- **required**
- Source navigation list; selected `value` drives loaded content
---
- `first('module-lazyload')`
- `HTMLElement & ModuleLazyloadProps`
- **required**
- Content target; receives `src` from listbox `value`
{% /table %}
