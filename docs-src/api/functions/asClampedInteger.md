### Function: asClampedInteger()

> **asClampedInteger**(`min?`, `max?`): [`Parser`](../type-aliases/Parser.md)\<`number`\>

Defined in: [src/parsers/number.ts:68](https://github.com/zeixcom/le-truc/blob/4745f51b23182fae3c5af6979d02c4ed2b72bcbb/src/parsers/number.ts#L68)

Parse a string as a clamped integer (>= min, <= max) with fallbacks

#### Parameters

##### min?

`number` = `0`

Minimum value

##### max?

`number` = `Number.MAX_SAFE_INTEGER`

Maximum value

#### Returns

[`Parser`](../type-aliases/Parser.md)\<`number`\>

Parser function

#### Since

2.0
