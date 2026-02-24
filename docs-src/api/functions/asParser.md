### Function: asParser()

> **asParser**\<`T`, `U`\>(`fn`): [`Parser`](../type-aliases/Parser.md)\<`T`, `U`\>

Defined in: [src/parsers.ts:114](https://github.com/zeixcom/le-truc/blob/ad10154c718841d91c46c4591c11dba351180731/src/parsers.ts#L114)

Brand a custom parser function with the `PARSER_BRAND` symbol.

Use this to wrap any custom two-argument parser so `isParser()` can
identify it reliably even when default parameters or destructuring
would otherwise reduce `function.length`.

#### Type Parameters

##### T

`T` *extends* `object`

##### U

`U` *extends* [`UI`](../type-aliases/UI.md)

#### Parameters

##### fn

[`Parser`](../type-aliases/Parser.md)\<`T`, `U`\>

Custom parser function to brand

#### Returns

[`Parser`](../type-aliases/Parser.md)\<`T`, `U`\>

The same function, branded

#### Since

0.17.0
