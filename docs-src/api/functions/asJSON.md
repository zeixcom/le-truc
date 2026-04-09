### Function: asJSON()

> **asJSON**\<`T`\>(`fallback`): [`Parser`](../type-aliases/Parser.md)\<`T`\>

Defined in: [src/parsers/json.ts:12](https://github.com/zeixcom/le-truc/blob/31e7cc1b8e62c6f8981bd8a73ff42a136ac376b1/src/parsers/json.ts#L12)

Parse a string as a JSON serialized object with a fallback

#### Type Parameters

##### T

`T` *extends* `object`

#### Parameters

##### fallback

`T`

Fallback value

#### Returns

[`Parser`](../type-aliases/Parser.md)\<`T`\>

Parser function

#### Since

0.11.0

#### Throws

If the value and fallback are both null or undefined

#### Throws

If value is not a valid JSON string
