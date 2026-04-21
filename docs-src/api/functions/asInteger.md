### Function: asInteger()

> **asInteger**(`fallback?`): [`Parser`](../type-aliases/Parser.md)\<`number`\>

Defined in: [src/parsers/number.ts:33](https://github.com/zeixcom/le-truc/blob/3d378e339ca819861372f356f408d3d000b2c62c/src/parsers/number.ts#L33)

Parse a string as a number forced to integer with a fallback

Supports hexadecimal and scientific notation

#### Parameters

##### fallback?

`number` = `0`

Fallback value

#### Returns

[`Parser`](../type-aliases/Parser.md)\<`number`\>

Parser function

#### Since

0.11.0
