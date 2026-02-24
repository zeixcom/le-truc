### Function: asEnum()

> **asEnum**(`valid`): [`Parser`](../type-aliases/Parser.md)\<`string`, [`UI`](../type-aliases/UI.md)\>

Defined in: [src/parsers/string.ts:29](https://github.com/zeixcom/le-truc/blob/62f34241868753829f1b0628a59b7cbc4dc09d76/src/parsers/string.ts#L29)

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
