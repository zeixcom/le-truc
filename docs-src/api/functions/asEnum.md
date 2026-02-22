### Function: asEnum()

> **asEnum**(`valid`): [`Parser`](../type-aliases/Parser.md)\<`string`, [`UI`](../type-aliases/UI.md)\>

Defined in: [src/parsers/string.ts:27](https://github.com/zeixcom/le-truc/blob/ce6fdde33897d7e14382a222c2fdd5e1804c6bd3/src/parsers/string.ts#L27)

Parser that constrains an attribute value to one of a fixed set of allowed strings.

Comparison is case-insensitive. If the attribute value is absent or does not match
any allowed value, the first entry of `valid` is returned as the default.

#### Parameters

##### valid

\[`string`, `...string[]`\]

Non-empty array of allowed values; first entry is the default

#### Returns

[`Parser`](../type-aliases/Parser.md)\<`string`, [`UI`](../type-aliases/UI.md)\>

Parser that returns a valid enum value

#### Since

0.9.0
