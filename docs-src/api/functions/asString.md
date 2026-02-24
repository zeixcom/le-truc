### Function: asString()

> **asString**\<`U`\>(`fallback?`): [`Parser`](../type-aliases/Parser.md)\<`string`, `U`\>

Defined in: [src/parsers/string.ts:11](https://github.com/zeixcom/le-truc/blob/a15d81f5442bf8607f9db7d5c4ecfccdb568a946/src/parsers/string.ts#L11)

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
