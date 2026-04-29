### Function: asParser()

> **asParser**\<`T`\>(`fn`): [`Parser`](../type-aliases/Parser.md)\<`T`\>

Defined in: [src/parsers.ts:54](https://github.com/zeixcom/le-truc/blob/e413fd39461fd5b549a5a02c7d0ccde7cbd1822c/src/parsers.ts#L54)

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
