### Function: bindAttribute()

> **bindAttribute**(`element`, `name`, `allowUnsafe?`): [`WatchHandlers`](../type-aliases/WatchHandlers.md)\<`string` \| `boolean`\>

Defined in: [src/helpers.ts:111](https://github.com/zeixcom/le-truc/blob/a45b49e21f141d0d53e4b986d3d37f6b090780f6/src/helpers.ts#L111)

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

[`WatchHandlers`](../type-aliases/WatchHandlers.md)\<`string` \| `boolean`\>

Watch handlers for the attribute

#### Since

2.0
