### Function: asInteger()

> **asInteger**(`fallback?`): [`Parser`](../type-aliases/Parser.md)\<`number`\>

Defined in: [src/parsers/number.ts:25](https://github.com/zeixcom/le-truc/blob/a45b49e21f141d0d53e4b986d3d37f6b090780f6/src/parsers/number.ts#L25)

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
