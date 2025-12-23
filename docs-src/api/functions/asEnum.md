[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / asEnum

# Function: asEnum()

> **asEnum**(`valid`): [`Parser`](../type-aliases/Parser.md)\<`string`, [`UI`](../type-aliases/UI.md)\>

Defined in: [src/parsers/string.ts:24](https://github.com/zeixcom/le-truc/blob/d42fb28a360f26c2ef62cbc9c1f4f11dd0f59654/src/parsers/string.ts#L24)

Parse a string as a multi-state value (for example: ['true', 'false', 'mixed'], defaulting to the first valid option

## Parameters

### valid

\[`string`, `...string[]`\]

Array of valid values

## Returns

[`Parser`](../type-aliases/Parser.md)\<`string`, [`UI`](../type-aliases/UI.md)\>

Parser function

## Since

0.9.0
