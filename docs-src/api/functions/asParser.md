### Function: asParser()

> **asParser**\<`T`\>(`fn`): [`Parser`](../type-aliases/Parser.md)\<`T`\>

Defined in: [src/parsers.ts:54](https://github.com/zeixcom/le-truc/blob/715e9bd5c4e382082b6ddd7a0cf9768da5f33744/src/parsers.ts#L54)

Brand a custom parser function with the `PARSER_BRAND` symbol.

Use this to wrap any custom parser so `isParser()` can identify it reliably.

#### Type Parameters

##### T

`T` *extends* `object`

#### Parameters

##### fn

[`Parser`](../type-aliases/Parser.md)\<`T`\>

Custom parser function to brand

#### Returns

[`Parser`](../type-aliases/Parser.md)\<`T`\>

The same function, branded

#### Since

0.16.2
