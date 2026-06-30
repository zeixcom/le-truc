### Function: asClampedInteger()

> **asClampedInteger**(`min?`, `max?`): [`Parser`](../type-aliases/Parser.md)\<`number`\>

Defined in: [src/parsers/number.ts:68](https://github.com/zeixcom/le-truc/blob/a00a78f0ec81c853d59278f25a4fb2f3f3684691/src/parsers/number.ts#L68)

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
