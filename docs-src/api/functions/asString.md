### Function: asString()

> **asString**(`fallback?`): [`Parser`](../type-aliases/Parser.md)\<`string`\>

Defined in: [src/parsers/string.ts:10](https://github.com/zeixcom/le-truc/blob/a45b49e21f141d0d53e4b986d3d37f6b090780f6/src/parsers/string.ts#L10)

Parser that returns the attribute value as a string, or a fallback when absent.

#### Parameters

##### fallback?

`string` = `''`

Static fallback string

#### Returns

[`Parser`](../type-aliases/Parser.md)\<`string`\>

Parser that returns the attribute string or the fallback

#### Since

0.11.0
