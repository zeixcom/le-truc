### Function: asClampedInteger()

> **asClampedInteger**(`min?`, `max?`): [`Parser`](../type-aliases/Parser.md)\<`number`\>

Defined in: [src/parsers/number.ts:60](https://github.com/zeixcom/le-truc/blob/41c579cf74dea25346deb2e44ba0238619c3dcd3/src/parsers/number.ts#L60)

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
