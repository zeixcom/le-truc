<overview>
Which Le Truc parser or reader to use for each prop initialisation pattern.
All parsers are imported from `@zeix/le-truc`.
</overview>

## Parser vs. Reader vs. static value

| Initializer kind | Reacts to attribute changes? | Use when |
|---|---|---|
| **Parser** (`asParser`-wrapped, ≥2 args) | 4-param: yes (added to `observedAttributes`); factory: no (called once at connect) | Prop configured by HTML authors via attributes |
| **Reader** (1-arg function, no `asParser`) | No — called once at connect time | Prop is initialised from current DOM state |
| **Static value** | No | Prop starts with a fixed default |

> **Attribute semantics:** Attributes are for server-side configuration by HTML authors. Properties are for reactive client-side state and programmatic changes. Both forms support parsers for the initial attribute read at connect time. Only the 4-param form re-runs parsers when attributes change on a live document.

## Parsers

### `asString(fallback?)`

Returns the attribute value as a string, or the fallback when absent.

```typescript
// fallback: empty string (default)
label: asString()

// fallback: static string
placeholder: asString('Search…')

// fallback: reader function (read from DOM at connect time)
label: asString(ui => ui.label.textContent ?? '')
```

### `asEnum(valid)`

Constrains the attribute to a fixed set of allowed values (case-insensitive). Returns the first entry as default when the attribute is absent or unrecognised.

```typescript
// first value is the default
size: asEnum(['medium', 'small', 'large'])

variant: asEnum(['default', 'primary', 'danger'])
```

### `asBoolean()`

Returns `true` when the attribute is present and its value is not `"false"`. Returns `false` otherwise. Matches the HTML boolean attribute convention.

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
```

### `asNumber(fallback?)`

Parses the attribute as a floating-point number. Returns the fallback when absent or invalid.

```typescript
ratio: asNumber(1.0)
progress: asNumber(0)
```

### `asJSON(fallback?)`

Parses the attribute as JSON. Throws `TypeError` for invalid JSON. Use for structured config passed via attribute.

```typescript
config: asJSON({ theme: 'light', size: 'medium' })
```

## `read(reader, fallback)` — DOM-initialised props

Composes a loose reader (may return `string | null | undefined`) with a parser or fallback into a typed `Reader<T>`. Use when the initial value should come from the DOM, not an attribute.

```typescript
// Read text content of a span and parse as integer
count: read(ui => ui.count.textContent, asInteger())

// Read value from a native input
value: read(ui => ui.input.value, asString())

// Read text with a static fallback
label: read(ui => ui.label?.textContent, 'Default label')
```

`read()` returns a Reader (one-argument function), so it is **not** added to `observedAttributes` — it is called once at connect time.

## Custom parsers

Wrap with `asParser()` so `isParser()` recognises the function reliably even when default parameters or destructuring would reduce `fn.length`:

```typescript
import { asParser } from '@zeix/le-truc'

const asColor = asParser((ui, value) => {
  if (value == null) return '#000000'
  return CSS.supports('color', value) ? value : '#000000'
})
```

**Always use `asParser()` for custom parsers.** Without it, detection falls back to `fn.length >= 2`, which is unreliable with default parameters, rest parameters, or destructuring.

## Choosing the right initializer

| Scenario | Use |
|---|---|
| HTML author configures via attribute; attribute changes must be reactive (4-param) | `asBoolean()`, `asString()`, `asEnum()`, `asInteger()`, `asNumber()`, `asJSON()` |
| HTML author configures via attribute; no live reactivity needed (factory) | Same parsers — called once at connect |
| Prop initial value lives in existing DOM content | `read(reader, fallback)` |
| Prop has a fixed starting value, not attribute-driven | Static value: `false`, `0`, `''`, `[]` |
| Prop is a reactive value from a signal | Pass the signal directly |
| Prop installs an imperative method on `host` | `asMethod(fn)` |
| Prop is driven by a DOM event (sensor-based) | `createEventsSensor(init, key, events)` from `events.ts` (see ARCHITECTURE.md) |
