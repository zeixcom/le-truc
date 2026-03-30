<overview>
The Le Truc component model: `defineComponent`, the reactivity flow, and the signal types re-exported from `@zeix/cause-effect`.
</overview>

## `defineComponent(name, props, select, setup)`

The single entry point for creating a reactive custom element.

| Argument | Type | Purpose |
|---|---|---|
| `name` | `string` | Tag name — lowercase, must contain a hyphen |
| `props` | `Record<string, Initializer>` | Reactive property definitions (see below) |
| `select` | `({ first, all }) => UI` | Queries the host's subtree; returns named DOM element references |
| `setup` | `(ui) => Effects` | Returns reactive effects keyed by UI element name |

The `ui` object passed to `setup` contains everything from `select` plus `host` (the element itself).

### Props initializers

| Initializer kind | How to recognize | When to use |
|---|---|---|
| Parser | Two-argument function; always wrap with `asParser()` | Attribute-driven prop: attribute string → typed value; auto-added to `observedAttributes` |
| Reader | One-argument function (not wrapped with `asParser()`) | DOM-derived initial value read once at connect time |
| MethodProducer | Function wrapped with `asMethod()` | Side-effect initializer that installs a method on `host` |
| Signal | Already a `Signal<T>` | Re-use an existing signal from a parent or context |
| Static value | Anything else | Fixed initial value for the prop |

### Effects return map

`setup` returns a plain object. Keys are UI element names (from `select`) plus `host`. Values are one Effect or an array of Effects for that element.

```typescript
({ host }) => ({
  button: setProperty('disabled'),       // one effect
  label: [setText('label'), toggleClass('active', 'isActive')],  // multiple effects
  host: on('keydown', handler),          // effect on the host element itself
})
```

## Reactivity flow

```
attribute change
      ↓
   parser(ui, attrValue)
      ↓
   host.prop = parsed value        ← Signal<T> backed by a Slot
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
