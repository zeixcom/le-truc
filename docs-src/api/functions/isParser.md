### Function: isParser()

> **isParser**\<`T`\>(`value`): `value is Parser<T>`

Defined in: [src/parsers.ts:32](https://github.com/zeixcom/le-truc/blob/c06fbd9800df065e7a4d81949422b458792c2deb/src/parsers.ts#L32)

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
