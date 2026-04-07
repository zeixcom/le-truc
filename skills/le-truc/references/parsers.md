<overview>
Which Le Truc parser or initializer to use for each prop in `expose()`.
All parsers are imported from `@zeix/le-truc`.
</overview>

## Initializer kinds in `expose()`

| Initializer kind | Use when |
|---|---|
| **Parser** (`asParser`-wrapped) | Prop is configured by HTML authors via attributes in server-rendered markup |
| **Static value** | Prop starts with a fixed default not derived from DOM or attributes |
| **Signal** | Prop is backed by an existing signal (e.g. `createEventsSensor(...)`) |
| **MemoCallback** `() => T` | Prop is a derived computed value (unbranded thunk) |
| **MethodProducer** (`asMethod`-wrapped) | Prop is an imperative method callable from outside |

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

## `createEventsSensor(element, init, events)` — event-driven props

Use inside `expose()` when a prop should update reactively from DOM events.

```typescript
expose({
  length: createEventsSensor(textbox, textbox.value.length, {
    input: ({ target }) => target.value.length,
  }),
})
```

The handler receives `{ event, target, prev }` and returns the new value (or `void` to leave unchanged).

## `asMethod(fn)` — imperative methods

`asMethod(fn)` brands `fn` as a `MethodProducer`. The function IS the method — it is installed directly as `host[key] = fn`.

```typescript
expose({
  clear: asMethod(() => {
    host.value = ''
    textbox.value = ''
    textbox.dispatchEvent(new Event('input', { bubbles: true }))
  }),
})
```

**Always use `asMethod()`.** An unbranded `() => void` function is treated as a `MemoCallback`, not a method.

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
| Prop installs an imperative method on `host` | `asMethod(fn)` |
| Prop is driven by DOM events | `createEventsSensor(element, init, events)` |
