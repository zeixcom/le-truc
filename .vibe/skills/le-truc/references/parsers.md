# Parsers

**Overview:** Which Le Truc parser or initializer to use for each prop in `expose()`. All parsers imported from `@zeix/le-truc`.

---

## Initializer Kinds in `expose()`

| Initializer Kind | Use When |
|---|---|
| **Parser** (`asParser`-wrapped) | Prop configured by HTML authors via attributes in server-rendered markup |
| **Static value** | Prop starts with fixed default not derived from DOM or attributes |
| **Signal (`state.get`)** | Prop is read-only to consumers; expose getter of `createState()` in factory closure |
| **MemoCallback** `() => T` | Prop is derived computed value (unbranded thunk) |
| **MethodProducer** (`defineMethod`-wrapped) | Prop is imperative method callable from outside |

> **Attribute semantics:** Attributes are for server-side configuration by HTML authors. Parsers in `expose()` called **once at connect time** — they read current attribute value from server-rendered markup. Attribute changes on live document do NOT trigger re-parsing.

> **Reading initial DOM values:** Read element state directly before calling `expose()`, then pass result as static value or wrap in parser:
>
> ```typescript
> expose({
>   count: asInteger(parseInt(countEl.textContent || '0') || 0),
>   value: textbox.value,
>   label: asString(labelEl?.textContent ?? ''),
> })
> ```

---

## Parsers

### `asString(fallback?)`

Returns attribute value as string, or fallback when absent.

```typescript
// fallback: empty string (default)
label: asString()

// fallback: static string
placeholder: asString('Search...')

// fallback derived from DOM — read before expose():
const labelText = labelEl?.textContent ?? ''
expose({ label: asString(labelText) })
```

### `asEnum(valid)`

Constrains attribute to fixed set of allowed values (case-insensitive). Returns first entry as default when absent or unrecognized.

```typescript
// first value is default
size: asEnum(['medium', 'small', 'large'])
variant: asEnum(['default', 'primary', 'danger'])
```

### `asBoolean()`

Returns `true` when attribute present and value not `"false"`. Returns `false` otherwise.

```typescript
disabled: asBoolean()
expanded: asBoolean()
```

### `asInteger(fallback?)`

Parses attribute as integer. Supports hexadecimal (`0x`) and scientific notation. Returns fallback when absent or invalid.

```typescript
// fallback: 0 (default)
count: asInteger()
max: asInteger(100)

// With DOM-derived fallback:
count: asInteger(parseInt(countEl.textContent || '0') || 0)
```

### `asNumber(fallback?)`

Parses attribute as floating-point number. Returns fallback when absent or invalid.

```typescript
ratio: asNumber(1.0)
progress: asNumber(0)
```

### `asJSON(fallback?)`

Parses attribute as JSON. Throws `TypeError` for invalid JSON.

```typescript
config: asJSON({ theme: 'light', size: 'medium' })
```

---

## Event-Driven Read-Only Props — `createState` + `on`

For props that update from DOM events and should not be settable by consumers, create `State` in factory closure and expose only its getter:

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
]
```

Write-protection comes from exposing `state.get` — a plain reactive function — rather than full `State`. Consumers see reactive getter with no setter.

To watch this prop inside same factory, pass signal directly rather than string prop name:

```typescript
watch(length, bindVisible(clearBtn))  // direct signal — skips host slot lookup
```

---

## `defineMethod(fn)` — Imperative Methods

`defineMethod(fn)` brands `fn` as `MethodProducer`. Function IS the method — installed directly as `host[key] = fn`.

```typescript
expose({
  clear: defineMethod(() => {
    host.value = ''
    textbox.value = ''
    textbox.dispatchEvent(new Event('input', { bubbles: true }))
  }),
})
```

**Always use `defineMethod()`.** Unbranded `() => void` function treated as `MemoCallback`, not method.

---

## Custom Parsers

Wrap with `asParser()` so `isParser()` recognizes function reliably:

```typescript
import { asParser } from '@zeix/le-truc'

const asColor = asParser((value: string | null | undefined): string => {
  if (value == null) return '#000000'
  return CSS.supports('color', value) ? value : '#000000'
})

expose({ color: asColor })
```

**Always use `asParser()` for custom parsers.** Parser signature: `(value: string | null | undefined) => T`.

---

## Choosing the Right Initializer

| Scenario | Use |
|---|---|
| HTML author configures via attribute | `asBoolean()`, `asString()`, `asEnum()`, `asInteger()`, `asNumber()`, `asJSON()` |
| Prop's initial value from existing DOM content | Read directly before `expose()`, pass as static or fallback |
| Prop has fixed starting value | Static: `false`, `0`, `''`, `[]` |
| Prop is reactive value from signal | Pass signal directly |
| Prop installs imperative method on `host` | `defineMethod(fn)` |
| Prop is event-driven and read-only to consumers | `createState(init)` in factory closure; expose `state.get`; update via `on()` handler |
