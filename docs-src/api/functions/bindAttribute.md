### Function: bindAttribute()

> **bindAttribute**(`element`, `name`, `allowUnsafe?`): [`SingleMatchHandlers`](../type-aliases/SingleMatchHandlers.md)\<`string` \| `boolean`\>

Defined in: [src/bindings.ts:249](https://github.com/zeixcom/le-truc/blob/db6b1a1848573cd9da112abcb4d5e3ad31b37308/src/bindings.ts#L249)

Returns `SingleMatchHandlers` that set or toggle an attribute with security validation.

- `ok(string)` → schedules `safeSetAttribute(el, name, value)` (or `el.setAttribute` if `allowUnsafe`)
- `ok(boolean)` → schedules `el.toggleAttribute(name, value)` — adds when `true`, removes when `false`
- `nil` → schedules `el.removeAttribute(name)`

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

Match handlers for the attribute mutation

#### Since

2.0
