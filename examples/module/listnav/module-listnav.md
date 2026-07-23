### Module Listnav

A navigation coordinator with no reactive properties. Demonstrates `pass()` to push `form-listbox`'s `value` into `module-lazyload`'s `src` property reactively, and a `run()` block wrapping `createEffect()` plus a `hashchange` listener to sync `location.hash` with the listbox selection in both directions (selection → hash via `history.replaceState`, hash → selection on `hashchange`). Shows how to wire two existing Le Truc components together without adding any new state to the coordinator.

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
