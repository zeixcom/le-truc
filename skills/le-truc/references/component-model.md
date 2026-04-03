<overview>
The Le Truc component model: both forms of `defineComponent`, the reactivity flow, and the signal types re-exported from `@zeix/cause-effect`.
</overview>

## `defineComponent` — two forms

### 2-param factory form (preferred, since 1.1)

```typescript
defineComponent<Props, UI>(name, factory)
```

| Argument | Type | Purpose |
|---|---|---|
| `name` | `string` | Tag name — lowercase, must contain a hyphen |
| `factory` | `({ first, all, host }) => { ui, props?, effects? }` | Called at connect time; returns UI element map, optional prop initializers, and optional effects |

The factory receives `{ first, all, host }` at connect time. All three return values share the same closure, so UI elements can be referenced directly — no `ui` object passed between functions.

```typescript
defineComponent<MyProps, MyUI>('my-component', ({ first, host }) => {
  const button = first('button', 'Add a native <button>.')
  const label = first('span.label')
  return {
    ui: { button, label },
    props: {
      disabled: read(() => button.disabled, false),
      label: read(() => label.textContent ?? '', ''),
    },
    effects: {
      button: setProperty('disabled'),
      label: setText('label'),
    },
  }
})
```

**Key constraint:** Components defined with the factory form have `observedAttributes = []`. Parsers in the `props` map are still called at connect time, so HTML authors can configure the component via attributes in server-rendered markup — but subsequent attribute changes on a live document do not trigger re-parsing. After connect, reactive state flows through the property interface only.

### 4-param form (use when attribute changes must be reactive)

```typescript
defineComponent<Props, UI>(name, props, select, setup)
```

| Argument | Type | Purpose |
|---|---|---|
| `name` | `string` | Tag name — lowercase, must contain a hyphen |
| `props` | `Record<string, Initializer>` | Reactive property definitions; parsers here auto-populate `observedAttributes` |
| `select` | `({ first, all }) => UI` | Queries the host's subtree; returns named DOM element references |
| `setup` | `(ui) => Effects` | Returns reactive effects keyed by UI element name |

The `ui` object passed to `setup` contains everything from `select` plus `host` (the element itself).

Use the 4-param form when attribute changes on a live document must reactively update component state (e.g., a server streaming new attribute values, or JS calling `setAttribute` to drive the component). Any prop whose initializer is a `Parser` is automatically added to `observedAttributes`.

HTML authors can still configure factory-form components via attributes in server-rendered markup — the parser reads the attribute once at connect time.

### Choosing between the two forms

| Scenario | Form |
|---|---|
| New component (default choice) | 2-param factory (preferred) |
| HTML authors configure the component via attributes in markup | Either — factory reads attributes once at connect time |
| Attribute changes on a live document must drive reactive updates | 4-param |

## Props initializers (both forms)

| Initializer kind | How to recognize | 4-param | 2-param factory |
|---|---|---|---|
| Parser | Wrapped with `asParser()`; takes `(ui, attrValue)` | Called at connect + re-runs on every attribute change | Called once at connect time only |
| Reader | One-argument function (not `asParser`-wrapped) | Called once at connect time | Called once at connect time |
| MethodProducer | Wrapped with `asMethod()` | Installs a method on `host` | Installs a method on `host` |
| Signal | Already a `Signal<T>` | Re-use an existing signal | Re-use an existing signal |
| Static value | Anything else | Fixed initial value | Fixed initial value |

## Effects return map

`setup` (4-param) or `effects` (factory return) is a plain object. Keys are UI element names plus `host`. Values are one Effect or an array of Effects.

```typescript
{
  button: setProperty('disabled'),                           // one effect
  label: [setText('label'), toggleClass('active', 'flag')], // multiple effects
  host: on('keydown', handler),                             // effect on the host
}
```

## Reactivity flow

```
(4-param only)
attribute change
      ↓
   parser(ui, attrValue)
      ↓
   host.prop = parsed value        ← Signal<T> backed by a Slot

(both forms)
event handler or external set
      ↓
   host.prop = new value           ← Signal<T> backed by a Slot
      ↓
   effect reads host.prop          ← registers dependency automatically
      ↓
   DOM update on target element
      ↓
   event handler fires
      ↓
   { prop: value } returned        ← or host.prop = value directly
      ↓
   signal.set(value) → effect re-runs
```

Key timing: effects run after all child custom elements in the subtree are defined (or after a 200ms timeout).

## `undefined` vs `null` from effects

- `undefined` — restore the original DOM value captured at setup time (not blank/null)
- `null` — delete the DOM value (remove the attribute, remove the style property)

## Re-exported signal types

Le Truc re-exports the full `@zeix/cause-effect` public API. Import everything from `@zeix/le-truc`:

```typescript
import {
  createState, createMemo, createSensor, createTask,
  createEffect, createScope, createSlot, createStore,
  createList, createCollection, deriveCollection,
  batch, untrack, unown, match,
  type State, type Memo, type Sensor, type Slot,
} from '@zeix/le-truc'
```

For detailed signal type guidance, use the `cause-effect` skill. Essential constraints:
- All signal generics require `T extends {}` — no `null` or `undefined` in the type parameter
- `createEffect` must be inside a `createScope` or another effect
- Use wrapper types or sentinel values to represent absence
