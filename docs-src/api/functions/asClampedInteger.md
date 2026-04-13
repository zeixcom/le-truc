### Function: asClampedInteger()

> **asClampedInteger**(`min?`, `max?`): [`Parser`](../type-aliases/Parser.md)\<`number`\>

Defined in: [src/parsers/number.ts:68](https://github.com/zeixcom/le-truc/blob/351fe6de1fcacfd814112a86c890ce84f0ea57f3/src/parsers/number.ts#L68)

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
