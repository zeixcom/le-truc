### Function: isParser()

> **isParser**\<`T`\>(`value`): `value is Parser<T>`

Defined in: [src/parsers.ts:32](https://github.com/zeixcom/le-truc/blob/26a8f71243082cdb967941bc1640290db2bf1985/src/parsers.ts#L32)

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
