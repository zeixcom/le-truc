### Function: bindAttribute()

> **bindAttribute**(`element`, `name`, `allowUnsafe?`): `WatchHandlers`\<`string` \| `boolean`\>

Defined in: [src/helpers.ts:110](https://github.com/zeixcom/le-truc/blob/bfd2f81a8a260038bb5d325733c64903b1f06cb3/src/helpers.ts#L110)

Returns `RunHandlers` that set or toggle an attribute with security validation.

- `ok(string)` → `safeSetAttribute(el, name, value)` (or `el.setAttribute` if `allowUnsafe`)
- `ok(boolean)` → `el.toggleAttribute(name, value)` — adds (without value) when `true`, removes when `false`
- `nil` → `el.removeAttribute(name)`

Pass `allowUnsafe: true` only when the value has been validated upstream.

#### Parameters

##### element

`Element`

Target element

##### name

`string`

Attribute name

##### allowUnsafe?

`boolean` = `false`

Skip security validation for string values

#### Returns

`WatchHandlers`\<`string` \| `boolean`\>

Watch handlers for the attribute

#### Since

1.1
