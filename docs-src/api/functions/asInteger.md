### Function: asInteger()

> **asInteger**(`fallback?`): [`Parser`](../type-aliases/Parser.md)\<`number`\>

Defined in: [src/parsers/number.ts:33](https://github.com/zeixcom/le-truc/blob/bc1e32256363451374968e851cb2302740e32636/src/parsers/number.ts#L33)

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
