### Function: bindAttribute()

> **bindAttribute**(`element`, `name`, `allowUnsafe?`): [`SingleMatchHandlers`](../type-aliases/SingleMatchHandlers.md)\<`string` \| `boolean`\>

Defined in: [src/helpers.ts:117](https://github.com/zeixcom/le-truc/blob/61224a1a87e995ff3784a4e2a215a09a403e4e85/src/helpers.ts#L117)

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
