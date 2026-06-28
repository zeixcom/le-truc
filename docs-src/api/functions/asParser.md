### Function: asParser()

> **asParser**\<`T`\>(`fn`): [`Parser`](../type-aliases/Parser.md)\<`T`\>

Defined in: [src/types.ts:135](https://github.com/zeixcom/le-truc/blob/b0a312070e75b8c347df329a83469bb95e181c8d/src/types.ts#L135)

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
