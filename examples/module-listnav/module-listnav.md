### Module Listnav

A navigation coordinator that syncs a listbox selection with lazy-loaded content and browser hash state.

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
* Selector
* Type
* Required
* Description
---
* `first('form-listbox')`
* `Component<FormListboxProps>`
* **required**
* Source navigation list; selected `value` drives loaded content
---
* `first('module-lazyload')`
* `Component<ModuleLazyloadProps>`
* **required**
* Content target; receives `src` from listbox `value`
{% /table %}
