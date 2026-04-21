### Function: asBoolean()

> **asBoolean**(): [`Parser`](../type-aliases/Parser.md)\<`boolean`\>

Defined in: [src/parsers/boolean.ts:13](https://github.com/zeixcom/le-truc/blob/3d378e339ca819861372f356f408d3d000b2c62c/src/parsers/boolean.ts#L13)

Parser that converts a boolean HTML attribute to an actual boolean.

Returns `true` when the attribute is present (value is not `null`) and its value
is not the string `'false'`. Returns `false` otherwise — matching standard HTML
boolean attribute semantics while allowing explicit opt-out via `attr="false"`.

#### Returns

[`Parser`](../type-aliases/Parser.md)\<`boolean`\>

Parser that returns `true` if the attribute is set and not `"false"`, `false` otherwise

#### Since

0.13.1
