### Function: asBoolean()

> **asBoolean**(): [`Parser`](../type-aliases/Parser.md)\<`boolean`, [`UI`](../type-aliases/UI.md)\>

Defined in: [src/parsers/boolean.ts:14](https://github.com/zeixcom/le-truc/blob/45798dee9dae4e450a431014c6b066824d261d20/src/parsers/boolean.ts#L14)

Parser that converts a boolean HTML attribute to an actual boolean.

Returns `true` when the attribute is present (value is not `null`) and its value
is not the string `'false'`. Returns `false` otherwise — matching standard HTML
boolean attribute semantics while allowing explicit opt-out via `attr="false"`.

#### Returns

[`Parser`](../type-aliases/Parser.md)\<`boolean`, [`UI`](../type-aliases/UI.md)\>

Parser that returns `true` if the attribute is set and not `"false"`, `false` otherwise

#### Since

0.13.1
