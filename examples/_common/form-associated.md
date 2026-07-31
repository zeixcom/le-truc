{% collapsible title="Participates in HTML forms via formAssociated(), which installs the native-parity form-control contract." %}

##### Properties

{% table %}
- Name
- Type
- Default
- Description
---
- `disabled`
- `boolean`
- `false`
- Whether the control is disabled; reflects the `disabled` attribute and inherits from an ancestor `<fieldset disabled>`
---
- `form`
- `HTMLFormElement \| null` (readonly)
- `null`
- Owning `<form>` element, or `null` if none
---
- `labels`
- `NodeList` (readonly)
- empty `NodeList`
- Associated `<label>` elements
---
- `name`
- `string`
- `''`
- Form field name; reflects the `name` attribute
---
- `validationMessage`
- `string` (readonly)
- `''`
- Current validation message
---
- `validity`
- `ValidityState` (readonly)
- valid
- Current validation state
---
- `willValidate`
- `boolean` (readonly)
- `false`
- Whether the control participates in constraint validation
{% /table %}

##### Methods

{% table %}
- Name
- Type
- Description
---
- `checkValidity`
- `() => boolean`
- Checks validity; returns `true` if valid
---
- `reportValidity`
- `() => boolean`
- Checks validity and reports the result to the user (e.g. validation bubble)
---
- `setCustomValidity`
- `(message: string) => void`
- Sets a custom validation error message; clears it when `message` is `''`
{% /table %}
{% /collapsible %}
