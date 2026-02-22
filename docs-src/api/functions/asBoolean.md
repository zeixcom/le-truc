### Function: asBoolean()

> **asBoolean**(): [`Parser`](../type-aliases/Parser.md)\<`boolean`, [`UI`](../type-aliases/UI.md)\>

Defined in: [src/parsers/boolean.ts:15](https://github.com/zeixcom/le-truc/blob/29beeda732ab654fc5e6eab73c276e5a5367d43a/src/parsers/boolean.ts#L15)

Parser that converts a boolean HTML attribute to an actual boolean.

Returns `true` when the attribute is present (value is not `null`) and its value
is not the string `'false'`. Returns `false` otherwise — matching standard HTML
boolean attribute semantics while allowing explicit opt-out via `attr="false"`.

#### Returns

[`Parser`](../type-aliases/Parser.md)\<`boolean`, [`UI`](../type-aliases/UI.md)\>

Parser that returns `true` if the attribute is set and not `"false"`, `false` otherwise

#### Since

0.13.1
