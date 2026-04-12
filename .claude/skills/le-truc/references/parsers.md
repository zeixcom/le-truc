<overview>
Which Le Truc parser or initializer to use for each prop in `expose()`.
All parsers are imported from `@zeix/le-truc`.
</overview>

## Initializer kinds in `expose()`

| Initializer kind | Use when |
|---|---|
| **Parser** (`asParser`-wrapped) | Prop is configured by HTML authors via attributes in server-rendered markup |
| **Static value** | Prop starts with a fixed default not derived from DOM or attributes |
| **Signal (`state.get`)** | Prop is read-only to consumers; expose the getter of a `createState()` in the factory closure |
| **MemoCallback** `() => T` | Prop is a derived computed value (unbranded thunk) |
| **MethodProducer** (`defineMethod`-wrapped) | Prop is an imperative method callable from outside |

> **Attribute semantics:** Attributes are for server-side configuration by HTML authors. Parsers in `expose()` are called **once at connect time** — they read the current attribute value from server-rendered markup. Attribute changes on a live document do not trigger re-parsing.

> **Reading initial DOM values:** Read element state directly before calling `expose()`, then pass the result as a static value or wrap in a parser:
> ```typescript
> expose({
>   count: asInteger(parseInt(countEl.textContent || '0') || 0),
>   value: textbox.value,
>   label: asString(labelEl?.textContent ?? ''),
> })
> ```

## Parsers

### `asString(fallback?)`

Returns the attribute value as a string, or the fallback when absent.

```typescript
// fallback: empty string (default)
label: asString()

// fallback: static string
placeholder: asString('Search…')

// fallback derived from DOM — read before expose():
const labelText = labelEl?.textContent ?? ''
expose({ label: asString(labelText) })
```

### `asEnum(valid)`

Constrains the attribute to a fixed set of allowed values (case-insensitive). Returns the first entry as default when absent or unrecognised.

```typescript
// first value is the default
size: asEnum(['medium', 'small', 'large'])

variant: asEnum(['default', 'primary', 'danger'])
```

### `asBoolean()`

Returns `true` when the attribute is present and its value is not `"false"`. Returns `false` otherwise.

```typescript
disabled: asBoolean()
expanded: asBoolean()
```

### `asInteger(fallback?)`

Parses the attribute as an integer. Supports hexadecimal (`0x`) and scientific notation. Returns the fallback when absent or invalid.

```typescript
// fallback: 0 (default)
count: asInteger()

max: asInteger(100)

// With DOM-derived fallback:
count: asInteger(parseInt(countEl.textContent || '0') || 0)
```

### `asNumber(fallback?)`

Parses the attribute as a floating-point number. Returns the fallback when absent or invalid.

```typescript
ratio: asNumber(1.0)
progress: asNumber(0)
```

### `asJSON(fallback?)`

Parses the attribute as JSON. Throws `TypeError` for invalid JSON.

```typescript
config: asJSON({ theme: 'light', size: 'medium' })
```

## Event-driven read-only props — `createState` + `on`

For props that update from DOM events and should not be settable by consumers, create a `State` in the factory closure and expose only its getter:

```typescript
const length = createState(textbox.value.length)

expose({
  value: textbox.value,
  length: length.get,  // getter only — consumers cannot set this prop
})

return [
  on(textbox, 'input', () => {
    length.set(textbox.value.length)
  }),
  // ...
]
```

Write-protection comes from exposing `state.get` — a plain reactive function — rather than the full `State`. Consumers see a reactive getter with no setter.

To watch this prop inside the same factory, pass the signal directly rather than the string prop name:

```typescript
watch(length, bindVisible(clearBtn))  // direct signal — skips host slot lookup
```

## `defineMethod(fn)` — imperative methods

`defineMethod(fn)` brands `fn` as a `MethodProducer`. The function IS the method — it is installed directly as `host[key] = fn`.

```typescript
expose({
  clear: defineMethod(() => {
    host.value = ''
    textbox.value = ''
    textbox.dispatchEvent(new Event('input', { bubbles: true }))
  }),
})
```

**Always use `defineMethod()`.** An unbranded `() => void` function is treated as a `MemoCallback`, not a method.

## Custom parsers

Wrap with `asParser()` so `isParser()` recognises the function reliably:

```typescript
import { asParser } from '@zeix/le-truc'

const asColor = asParser((value: string | null | undefined): string => {
  if (value == null) return '#000000'
  return CSS.supports('color', value) ? value : '#000000'
})

expose({ color: asColor })
```

**Always use `asParser()` for custom parsers.** Parser signature: `(value: string | null | undefined) => T`.

## Choosing the right initializer

| Scenario | Use |
|---|---|
| HTML author configures via attribute | `asBoolean()`, `asString()`, `asEnum()`, `asInteger()`, `asNumber()`, `asJSON()` |
| Prop's initial value comes from existing DOM content | Read directly before `expose()`, pass as static or fallback |
| Prop has a fixed starting value | Static: `false`, `0`, `''`, `[]` |
| Prop is a reactive value from a signal | Pass the signal directly |
| Prop installs an imperative method on `host` | `defineMethod(fn)` |
| Prop is event-driven and read-only to consumers | `createState(init)` in factory closure; expose `state.get`; update via `on()` handler |
