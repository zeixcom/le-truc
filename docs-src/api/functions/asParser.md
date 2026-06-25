### Function: asParser()

> **asParser**\<`T`\>(`fn`): [`Parser`](../type-aliases/Parser.md)\<`T`\>

Defined in: [src/types.ts:135](https://github.com/zeixcom/le-truc/blob/db6b1a1848573cd9da112abcb4d5e3ad31b37308/src/types.ts#L135)

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
