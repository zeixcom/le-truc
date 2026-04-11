### Function: bindAttribute()

> **bindAttribute**(`element`, `name`, `allowUnsafe?`): [`SingleMatchHandlers`](../type-aliases/SingleMatchHandlers.md)\<`string` \| `boolean`\>

Defined in: [src/helpers.ts:97](https://github.com/zeixcom/le-truc/blob/4b464bcaf232e6baac491b9eb42d2a86dd71e380/src/helpers.ts#L97)

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

[`SingleMatchHandlers`](../type-aliases/SingleMatchHandlers.md)\<`string` \| `boolean`\>

Watch handlers for the attribute

#### Since

2.0
