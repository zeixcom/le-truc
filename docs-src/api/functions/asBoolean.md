### Function: asBoolean()

> **asBoolean**(): [`Parser`](../type-aliases/Parser.md)\<`boolean`\>

Defined in: [src/parsers/boolean.ts:16](https://github.com/zeixcom/le-truc/blob/4098d5791c279825fcbaa4a549a14c3639e84375/src/parsers/boolean.ts#L16)

Parser that converts a boolean HTML attribute to an actual boolean.

Returns `true` when the attribute is present (value is not `null`) and its value
is not the string `'false'`, compared case-insensitively (`'FALSE'`, `'False'`, …
also opt out). Returns `false` otherwise — matching standard HTML boolean attribute
semantics while allowing explicit opt-out via `attr="false"`, and also covering
ARIA-style string-boolean attributes (e.g. `aria-hidden="true"`/`"false"`), which
are conventionally case-insensitive.

#### Returns

[`Parser`](../type-aliases/Parser.md)\<`boolean`\>

Parser that returns `true` if the attribute is set and not (case-insensitively) `"false"`, `false` otherwise

#### Since

0.13.1
