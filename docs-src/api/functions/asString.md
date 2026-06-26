### Function: asString()

> **asString**(`fallback?`): [`Parser`](../type-aliases/Parser.md)\<`string`\>

Defined in: [src/parsers/string.ts:10](https://github.com/zeixcom/le-truc/blob/62831a486b22055e2f0aae8a1bc13f5e79ffdffc/src/parsers/string.ts#L10)

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
