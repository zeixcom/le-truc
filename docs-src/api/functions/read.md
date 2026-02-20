### Function: read()

> **read**\<`T`, `U`\>(`reader`, `fallback`): [`Reader`](../type-aliases/Reader.md)\<`T`, `U`\>

Defined in: [src/parsers.ts:69](https://github.com/zeixcom/le-truc/blob/569c3554a3bd73c7996dc67fec548045ec940d32/src/parsers.ts#L69)

Read a value from a UI element

#### Type Parameters

##### T

`T` *extends* `object`

##### U

`U` *extends* [`UI`](../type-aliases/UI.md)

#### Parameters

##### reader

[`LooseReader`](../type-aliases/LooseReader.md)\<`T`, `U`\>

Reader function returning T | string | null | undefined

##### fallback

[`ParserOrFallback`](../type-aliases/ParserOrFallback.md)\<`T`, `U`\>

Fallback value or parser function

#### Returns

[`Reader`](../type-aliases/Reader.md)\<`T`, `U`\>

Parsed value or fallback value

#### Since

0.15.0
