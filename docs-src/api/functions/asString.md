### Function: asString()

> **asString**(`fallback?`): [`Parser`](../type-aliases/Parser.md)\<`string`\>

Defined in: [src/parsers/string.ts:10](https://github.com/zeixcom/le-truc/blob/31e7cc1b8e62c6f8981bd8a73ff42a136ac376b1/src/parsers/string.ts#L10)

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
