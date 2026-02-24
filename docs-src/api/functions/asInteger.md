### Function: asInteger()

> **asInteger**\<`U`\>(`fallback?`): [`Parser`](../type-aliases/Parser.md)\<`number`, `U`\>

Defined in: [src/parsers/number.ts:26](https://github.com/zeixcom/le-truc/blob/c76fdd788c0b9a613a5dd883bb02ba2aa0c3b1ba/src/parsers/number.ts#L26)

Parse a string as a number forced to integer with a fallback

Supports hexadecimal and scientific notation

#### Type Parameters

##### U

`U` *extends* [`UI`](../type-aliases/UI.md)

#### Parameters

##### fallback?

[`Fallback`](../type-aliases/Fallback.md)\<`number`, `U`\> = `0`

Fallback value or reader function

#### Returns

[`Parser`](../type-aliases/Parser.md)\<`number`, `U`\>

Parser function

#### Since

0.11.0
