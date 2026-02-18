### Function: asString()

> **asString**\<`U`\>(`fallback?`): [`Parser`](../type-aliases/Parser.md)\<`string`, `U`\>

Defined in: [src/parsers/string.ts:12](https://github.com/zeixcom/le-truc/blob/9899f5d34ea29fc1973736236835ba462d0ed87a/src/parsers/string.ts#L12)

Pass through string with a fallback

#### Type Parameters

##### U

`U` *extends* [`UI`](../type-aliases/UI.md)

#### Parameters

##### fallback?

[`Fallback`](../type-aliases/Fallback.md)\<`string`, `U`\> = `''`

Fallback value or reader function

#### Returns

[`Parser`](../type-aliases/Parser.md)\<`string`, `U`\>

Parser function

#### Since

0.11.0
