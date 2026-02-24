### Function: asJSON()

> **asJSON**\<`T`, `U`\>(`fallback`): [`Parser`](../type-aliases/Parser.md)\<`T`, `U`\>

Defined in: [src/parsers/json.ts:13](https://github.com/zeixcom/le-truc/blob/2cea8afdd3d4dfbc6a9eee6db9acf561d507d360/src/parsers/json.ts#L13)

Parse a string as a JSON serialized object with a fallback

#### Type Parameters

##### T

`T` *extends* `object`

##### U

`U` *extends* [`UI`](../type-aliases/UI.md)

#### Parameters

##### fallback

[`Fallback`](../type-aliases/Fallback.md)\<`T`, `U`\>

Fallback value or reader function

#### Returns

[`Parser`](../type-aliases/Parser.md)\<`T`, `U`\>

Parser function

#### Since

0.11.0

#### Throws

If the value and fallback are both null or undefined

#### Throws

If value is not a valid JSON string
