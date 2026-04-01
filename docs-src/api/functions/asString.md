### Function: asString()

> **asString**\<`U`\>(`fallback?`): [`Parser`](../type-aliases/Parser.md)\<`string`, `U`\>

Defined in: [src/parsers/string.ts:11](https://github.com/zeixcom/le-truc/blob/aeeac355aad9805eb8ee281d5c2dacf08589e2c9/src/parsers/string.ts#L11)

Parser that returns the attribute value as a string, or a fallback when absent.

#### Type Parameters

##### U

`U` *extends* [`UI`](../type-aliases/UI.md)

#### Parameters

##### fallback?

[`Fallback`](../type-aliases/Fallback.md)\<`string`, `U`\> = `''`

Static fallback string or reader function

#### Returns

[`Parser`](../type-aliases/Parser.md)\<`string`, `U`\>

Parser that returns the attribute string or the resolved fallback

#### Since

0.11.0
