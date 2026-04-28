### Function: asInteger()

> **asInteger**(`fallback?`): [`Parser`](../type-aliases/Parser.md)\<`number`\>

Defined in: [src/parsers/number.ts:33](https://github.com/zeixcom/le-truc/blob/a6ba00692d657f602c75b7a74d7e0a0da4505ef9/src/parsers/number.ts#L33)

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
