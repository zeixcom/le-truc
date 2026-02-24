### Function: isParser()

> **isParser**\<`T`, `U`\>(`value`): `value is Parser<T, U>`

Defined in: [src/parsers.ts:50](https://github.com/zeixcom/le-truc/blob/216682a13a682782a7a31b91ce98c0ec9f53511a/src/parsers.ts#L50)

Check if a value is a parser

Checks for the `PARSER_BRAND` symbol first. Falls back to `fn.length >= 2`
for backward compatibility, emitting a DEV_MODE warning when the fallback
is triggered so authors can migrate to `asParser()`.

#### Type Parameters

##### T

`T` *extends* `object`

##### U

`U` *extends* [`UI`](../type-aliases/UI.md)

#### Parameters

##### value

`unknown`

Value to check if it is a parser

#### Returns

`value is Parser<T, U>`

True if the value is a parser, false otherwise

#### Since

0.14.0
