### Function: asEnum()

> **asEnum**(`valid`): [`Parser`](../type-aliases/Parser.md)\<`string`\>

Defined in: [src/parsers/string.ts:23](https://github.com/zeixcom/le-truc/blob/ebcbf01637bdcb601f1fd2e375df0533946188e6/src/parsers/string.ts#L23)

Parser that constrains an attribute value to one of a fixed set of allowed strings.

Comparison is case-insensitive. If the attribute value is absent or does not match
any allowed value, the first entry of `valid` is returned as the default.

#### Parameters

##### valid

\[`string`, `...string[]`\]

Non-empty array of allowed values; first entry is the default

#### Returns

[`Parser`](../type-aliases/Parser.md)\<`string`\>

Parser that returns a valid enum value

#### Since

0.9.0
