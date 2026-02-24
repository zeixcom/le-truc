### Function: asInteger()

> **asInteger**\<`U`\>(`fallback?`): [`Parser`](../type-aliases/Parser.md)\<`number`, `U`\>

Defined in: [src/parsers/number.ts:26](https://github.com/zeixcom/le-truc/blob/216682a13a682782a7a31b91ce98c0ec9f53511a/src/parsers/number.ts#L26)

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
