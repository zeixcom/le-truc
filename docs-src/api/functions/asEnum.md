### Function: asEnum()

> **asEnum**(`valid`): [`Parser`](../type-aliases/Parser.md)\<`string`, [`UI`](../type-aliases/UI.md)\>

Defined in: [src/parsers/string.ts:24](https://github.com/zeixcom/le-truc/blob/9899f5d34ea29fc1973736236835ba462d0ed87a/src/parsers/string.ts#L24)

Parse a string as a multi-state value (for example: ['true', 'false', 'mixed'], defaulting to the first valid option

#### Parameters

##### valid

\[`string`, `...string[]`\]

Array of valid values

#### Returns

[`Parser`](../type-aliases/Parser.md)\<`string`, [`UI`](../type-aliases/UI.md)\>

Parser function

#### Since

0.9.0
