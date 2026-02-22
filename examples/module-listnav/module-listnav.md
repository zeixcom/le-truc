### Module Listnav

A navigation coordinator with no reactive properties. Demonstrates `pass()` to push `form-listbox`'s `value` into `module-lazyload`'s `src` property reactively, and a custom raw effect on `host` that uses `createEffect()` to sync `location.hash` with the listbox selection in both directions (selection → hash on change, hash → selection on `popstate`). Shows how to wire two existing Le Truc components together without adding any new state to the coordinator.

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
