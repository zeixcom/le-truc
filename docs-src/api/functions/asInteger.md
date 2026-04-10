### Function: asInteger()

> **asInteger**(`fallback?`): [`Parser`](../type-aliases/Parser.md)\<`number`\>

Defined in: [src/parsers/number.ts:25](https://github.com/zeixcom/le-truc/blob/61a4980d5c6f404aabf340d018832f060d2545fc/src/parsers/number.ts#L25)

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
