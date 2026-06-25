### Function: isParser()

> **isParser**\<`T`\>(`value`): `value is Parser<T>`

Defined in: [src/types.ts:100](https://github.com/zeixcom/le-truc/blob/fb30eb45f0c70696e40c4386c2a1ac5bb1d7b808/src/types.ts#L100)

Check if a value is a parser

Checks for the `PARSER_BRAND` symbol. Unbranded functions are NOT treated as
parsers — always use `asParser()` to brand custom parsers.

#### Type Parameters

##### T

`T` *extends* `object`

#### Parameters

##### value

`unknown`

Value to check if it is a parser

#### Returns

`value is Parser<T>`

True if the value is a parser, false otherwise

#### Since

0.14.0
