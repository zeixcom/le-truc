### Function: asParser()

> **asParser**\<`T`\>(`fn`): [`Parser`](../type-aliases/Parser.md)\<`T`\>

Defined in: [src/parsers.ts:54](https://github.com/zeixcom/le-truc/blob/a45b49e21f141d0d53e4b986d3d37f6b090780f6/src/parsers.ts#L54)

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
