### Function: asInteger()

> **asInteger**\<`U`\>(`fallback?`): [`Parser`](../type-aliases/Parser.md)\<`number`, `U`\>

Defined in: [src/parsers/number.ts:27](https://github.com/zeixcom/le-truc/blob/29beeda732ab654fc5e6eab73c276e5a5367d43a/src/parsers/number.ts#L27)

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
