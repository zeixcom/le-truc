---
title: 'Accessibility'
emoji: '♿'
description: 'ARIA reflection via ElementInternals and bindAria()'
---

{% hero %}
# Accessibility

**Reflect ARIA semantics from a signal with `bindAria()`.** Content attributes and `ElementInternals` reflection are two complementary channels, not competitors — the consumer owns one, the component owns the other.
{% /hero %}

{% section %}
## ARIA Reflection

ARIA semantics have two channels. **Content attributes** face the consumer. **Reflection properties** (`internals.ariaExpanded`, `trigger.ariaLabel`) are the component's own defaults. The `bindAria()` helper drives the reflection channel from a signal:

```js
defineComponent('my-disclosure', ({ first, host, internals, on, watch }) => {
  const trigger = first('button', 'Add a native button as the trigger.')

  expose({ expanded: false })

  on(trigger, 'click', () => ({ expanded: !host.expanded }))
  // Host default semantics: invisible in markup, consumer can still override
  watch('expanded', bindAria(internals, 'ariaExpanded'))
})
```

`bindAria(target, name)` accepts any `ARIAMixin` target:

- **`internals`** — on the factory context of every component. It is `null` only if `attachInternals()` failed, and every handler degrades to a no-op. The write sets default semantics on the host. No attribute appears in markup. No consumer framework rewriting attributes can overwrite the value. If the environment ships an `ElementInternals` whose reflection does not reach the platform, `bindAria()` binds the host content attribute instead, with the same coercion table — the eight element-reference properties have no attribute form and stay no-ops. There the attribute is the channel, so the shadowing-attribute removal never runs.
- **A native element** — the write mirrors into the content attribute. CSS selectors and `getAttribute()` still see the value.

The handler assigns values the way the reflection API expects:

| Watched value | Assigned |
|---|---|
| `boolean` | `'true'` or `'false'` |
| `number` | Decimal string |
| `string`, `Element`, `Element[]` | Unchanged |
| `null` / `undefined` | `null` — clears the reflection |

`bindAria()` also has the [map form](effects.html#bind-several-targets-from-one-source):

```js
watch(
  () => ({ ariaValueNow: `${degree}`, ariaValueText: `${degree} degrees` }),
  bindAria(internals, ['ariaValueNow', 'ariaValueText']),
)
```

Set static ARIA directly in the factory. `internals.role = 'slider'` is shorter than any helper call.

{% callout .note title="The server-rendered attribute is the initial value" %}
A host content attribute **overrides** the reflection value in the accessibility tree. A stale `aria-expanded="false"` from the server would silence every later update through `internals`. `bindAria()` removes the shadowing attribute for you — once per property, at the first value the binding applies. After that, the component owns the property. On the attribute fallback there is nothing to remove: the attribute is the live channel, and the binding updates it in place. A consumer who sets the attribute **after** connect still overrides it. Never write both channels for the same property on the same element.
{% /callout %}

{% /section %}

{% section %}
## Choose the Channel

| Concern | Channel |
|---|---|
| Initial state in server-rendered HTML | Content attribute — a `Parser` reads it at connect time |
| Consumer overrides component semantics | Content attribute — the platform guarantees the host attribute wins |
| Component-owned state on the host (`role`, `aria-expanded`, `aria-valuenow`) | `internals.aria*` via `bindAria()` |
| Component-internal relationships (label, description, controls, active descendant) | Element references via `bindAria()` |
| Relationships the consumer authors | Content attribute (IDREF) — the component only reads it |
| State that CSS must select on | Content attribute — internals values are invisible to CSS |

axe-core 4.13 and later can see `internals.role` on every Le Truc component. Le Truc registers each component's internals in the [ElementInternals declaration](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/element-internals-declaration.md) registry for you. The tooling reach is partial: only the attribute-validity rules (`aria-allowed-attr`, `aria-prohibited-attr`) act on an internals-only role. The nesting rules (`aria-required-parent`, `aria-required-children`) inspect only elements with a `role` attribute. Keep structural roles (`list`, `table`, `menu`, and their required children) on the attribute channel, or keep the native element.

Do not use `ariaOwnsElements`. Chromium does not implement it, and its `aria-owns` semantics are problematic on their own. Le Truc components own their internal structure and never need it.

{% /section %}
