### Function: asClampedInteger()

> **asClampedInteger**(`min?`, `max?`): [`Parser`](../type-aliases/Parser.md)\<`number`\>

Defined in: [src/parsers/number.ts:68](https://github.com/zeixcom/le-truc/blob/61224a1a87e995ff3784a4e2a215a09a403e4e85/src/parsers/number.ts#L68)

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
