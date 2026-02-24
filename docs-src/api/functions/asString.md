### Function: asString()

> **asString**\<`U`\>(`fallback?`): [`Parser`](../type-aliases/Parser.md)\<`string`, `U`\>

Defined in: [src/parsers/string.ts:11](https://github.com/zeixcom/le-truc/blob/53281ff4634318c8e0964232bafee60d7a1ccdb2/src/parsers/string.ts#L11)

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
