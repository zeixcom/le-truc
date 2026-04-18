### Function: asString()

> **asString**(`fallback?`): [`Parser`](../type-aliases/Parser.md)\<`string`\>

Defined in: [src/parsers/string.ts:10](https://github.com/zeixcom/le-truc/blob/f8dbc86585fb0a5dd6f0ac2867231d04b1cf7d6c/src/parsers/string.ts#L10)

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
