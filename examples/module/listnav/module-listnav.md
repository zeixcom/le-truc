### Module Listnav

A navigation component that keeps the URL hash in sync with a `form-listbox` selection and loads content via `module-lazyload`.

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
