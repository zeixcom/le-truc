---
title: 'Extensions'
emoji: '🧩'
description: 'Form participation, observed attributes, debug'
---

{% hero %}
# Extensions

**Opt-in capabilities, imported separately, tree-shaken away when unused.** Form participation, attribute-driven reactivity, and debug instrumentation extend `defineComponent()` through a third argument.
{% /hero %}

{% section %}
## How Extensions Work

The core of Le Truc stays small by staying out of the way. When a component needs more than the core — a seat in a native `<form>`, say — that capability ships as an **extension**: a small, tree-shakable module passed as the third argument to `defineComponent()`.

```js
defineComponent('my-element', factory, [formAssociated()])
```

Each extension implements the `ComponentExtension` interface:
- A `name`
- A set of `staticProps` to install on the generated class (e.g. `static formAssociated = true`)
- `observedAttributes` and `reservedMembers` it contributes
- Optional lifecycle hooks (`installOnPrototype`, `onConnect`, `onAttributeChanged`)

`defineComponent()` folds the array once at class-definition time. `staticProps` collisions throw `ExtensionCollisionError` in dev mode (first declaration wins in production). `observedAttributes` and `reservedMembers` are unions across all extensions.

Le Truc ships three extensions, each imported separately:

| Extension | Purpose |
|---|---|
| [`formAssociated()`](#form-association) | Form participation via `ElementInternals` — value sync, reset, state restore, disabled, native-parity host contract |
| [`formAssociatedCheckbox()`](#checkbox-shaped-controls) | Form participation keyed on a `checked: boolean` prop — submits nothing when unchecked |
| [`observedAttributes()`](#attribute-driven-reactivity) | Re-parses Parser-backed props when their attribute mutates after connect |

A fourth extension, [`debug()`](#debug-instrumentation), ships too — but it doesn't appear in this table, because you never add it yourself.

{% /section %}

{% section %}
## Form Association

The `formAssociated()` extension adapts a component to the [form-associated custom element](https://html.spec.whatwg.org/multipage/custom-elements.html#custom-elements-face-example) convention. Pass it as the first element of the extensions array:

```js#form-textbox.js
defineComponent<FormTextboxProps>(
  'form-textbox',
  ({ expose, first, host, internals, watch }) => {
    const textbox = first('input, textarea')

    expose({ value: textbox.value })

    // Typed validity flags via the internals escape hatch
    watch(
      () => ({ value: host.value, max: host.maxLength }),
      ({ value, max }) => {
        internals?.setValidity(
          { tooLong: value.length > max },
          value.length > max ? `Max ${max} characters` : '',
        )
      },
    )
  },
  [formAssociated()],
)
```

With `[formAssociated()]`, Le Truc manages for you:
- Form value sync
- Reset
- State restore
- A `<fieldset disabled>`-aware `disabled` property

The host gains a native-parity contract delegating to `internals`: `form`, `name`, `labels`, `validity`, `validationMessage`, `willValidate`, `checkValidity()`, `reportValidity()`, `setCustomValidity()`. It also gains a managed `defaultValue` property — the reset baseline, mirroring `<input>.defaultValue`. When the prop is Parser-backed, `defaultValue` reflects the live `value` content attribute through that Parser. Setting it moves the baseline for the next form reset; it never changes the live `value`. External consumers read them as on a native input. The convention requires a reactive `value` property. Expose it and sync it to the underlying native control as usual. `expose()` throws `InvalidPropertyNameError` for any reserved member name managed by the extension — `defaultValue` is one of them.

The `internals` object on the context (`null` only if `attachInternals()` failed) is the escape hatch for typed validity flags, custom `:state()` pseudo-classes, and [ARIA reflection](accessibility.html). Follow this rule: use `internals?.setFormValue()` indirectly through the managed convention. Set `value`, and it syncs automatically. Call `internals?.setValidity()` directly when you need flags beyond a simple custom-error message.

{% /section %}

{% section %}
## Checkbox-Shaped Controls

A checkbox's primary state is `checked: boolean`. It submits nothing when unchecked, unlike `formAssociated()`'s always-on string `value`. The `formAssociatedCheckbox()` extension handles this shape. It shares the same host contract and `disabled` management as `formAssociated()`. Its value-sync, reset, and state-restore mechanics target a `checked` prop instead of `value`:

```js#form-checkbox.js
defineComponent<FormCheckboxProps>(
  'form-checkbox',
  ({ expose, first, on, watch }) => {
    const checkbox = first('input[type="checkbox"]')

    expose({ checked: asBoolean() })

    on(checkbox, 'change', () => ({ checked: checkbox.checked }))
    watch('checked', bindProperty(checkbox, 'checked'))
  },
  [formAssociatedCheckbox()],
)
```

`internals.setFormValue()` receives the host's own `value` attribute when checked (default `'on'`, matching native `<input type="checkbox">`) and `null` when unchecked. The convention requires a reactive `checked` property. The reset baseline is a managed `defaultChecked` property, mirroring `<input>.defaultChecked`: it reflects the `checked` attribute, and setting it moves the baseline for the next form reset without changing the live `checked`.

{% callout .caution title="Do not combine the two form extensions" %}
Both `formAssociated()` and `formAssociatedCheckbox()` declare the same `staticProps.formAssociated` key. Combining them on one component throws `ExtensionCollisionError` in dev mode. Radio groups and listboxes do not need `formAssociatedCheckbox()`. Their selection aggregates into one string `value` on the container, which fits `formAssociated()`.
{% /callout %}

{% callout .caution title="Do not observe value or checked on a form-associated component" %}
On a form-associated component, the `value` attribute is the reset baseline, not a live-value channel. Passing `value` to `observedAttributes()` re-parses the baseline attribute into the live prop on every mutation, so baseline updates apply live and the two channels stop being distinct. The same applies to `checked` with `formAssociatedCheckbox()`. Use the property as the sole live edit path.
{% /callout %}

{% /section %}

{% section %}
## Relaying Native Control Validity

A component that wraps a native control (`<input>`, `<select>`, `<textarea>`) — a spinbutton around `<input type="number">`, a masked field around `<input type="text">` — can relay the control's own `ValidityState` onto `host.validity` with `relayValidity(internals, control, anchor?)`. This surfaces every constraint the browser already checks (`rangeOverflow`, `stepMismatch`, `badInput`, `valueMissing`, …), instead of collapsing them into a single `customError`. It fully replaces `host.validity`, including the control's own `customError` — the control's live state is the whole truth about itself. It is not reactive. Call it from an event handler on the wrapped control:

```js#form-enhanced-input.js
import { defineComponent, formAssociated, relayValidity } from '@zeix/le-truc'

export default defineComponent(
	'form-enhanced-input',
	({ first, internals, on }) => {
		const input = first('input', 'Add a native input')
		on(input, 'input', () => relayValidity(internals, input))
	},
	[formAssociated()],
)
```

See `form-spinbutton.ts` for a complete example.

{% /section %}

{% section %}
## Attribute-Driven Reactivity

Properties are the primary reactive interface. By design, a `Parser` passed to `expose()` reads its attribute once, at connect time. Attribute changes after connect do not re-run it. The `observedAttributes()` extension is the opt-in escape hatch. Use it when you need the parser to fire again on later attribute mutations. This matters for interoperability with frameworks like React that set DOM attributes on custom elements rather than properties:

```js#basic-gauge.js
defineComponent<BasicGaugeProps>(
  'basic-gauge',
  ({ expose, watch }) => {
    expose({ value: asNumber() })

    watch('value', v => { /* update the gauge */ })
  },
  [observedAttributes(['value'])],
)
```

Le Truc adds named attributes to the class's `static observedAttributes`. On each mutation, the extension re-runs the same retained `Parser` against the attribute's new string value. It writes the result to the prop. Props whose initializer is not a branded `Parser` are left untouched.

Use this sparingly. For most components, event handlers or direct property writes are the right way to update state after connect. On form-associated components, do not observe `value` — or `checked` with `formAssociatedCheckbox()`; see the caution in [Form Association](#form-association).

{% callout .caution title="Do not observe value or checked on a form-associated component" %}
On a form-associated component, the `value` attribute is the reset baseline, not a live-value channel. Passing `value` to `observedAttributes()` re-parses the baseline attribute into the live prop on every mutation, so baseline updates apply live and the two channels stop being distinct. The same applies to `checked` with `formAssociatedCheckbox()`. Use the property as the sole live edit path.
{% /callout %}

{% /section %}

{% section %}
## Debug Instrumentation

`debug()` is not exported, and you never pass it to `defineComponent()`. Build your app with `DEV_MODE="true"`, and every component gets a reactive `debug: boolean` property for free. Instrumenting one specific component instance shouldn't require editing its source.

Toggle `debug` from the browser's properties panel, or hold `Cmd`/`Ctrl` and click the component. While `debug` is `true`:
- The host carries a pulsing box-shadow indicator on every `on()`, `pass()`, or `watch()` firing
- Target elements that `on()`, `pass()`, or a `bind*`-backed `watch()` handler act on get a presence-only marking attribute (`data-le-truc-on`, `-pass`, or `-watch`)
- Each firing logs one `console.debug()` entry naming the component and, where known, the event or target

A `watch()` handler not produced by a `bind*` helper (`bindText`, `bindProperty`, and so on) can't be traced back to an element. Le Truc shows the host-level pulse only, rather than guess.

`debug` does nothing in production. The property doesn't exist without `DEV_MODE`, because the extension that provides it was never added to the component.

{% callout .caution title="debug is a reserved property name in DEV_MODE" %}
`expose({ debug: ... })` throws in a `DEV_MODE` build, on any component. The name is reserved the moment `DEV_MODE` is on. Avoid `debug` as a prop name.
{% /callout %}

{% /section %}
