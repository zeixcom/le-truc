### Function: asNumber()

> **asNumber**\<`U`\>(`fallback?`): [`Parser`](../type-aliases/Parser.md)\<`number`, `U`\>

Defined in: [src/parsers/number.ts:51](https://github.com/zeixcom/le-truc/blob/23167c4de345bf28cd627a58ae4ea4e29243c54c/src/parsers/number.ts#L51)

Parse a string as a number with a fallback

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
