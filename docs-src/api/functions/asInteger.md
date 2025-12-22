[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / asInteger

# Function: asInteger()

> **asInteger**\<`U`\>(`fallback?`): [`Parser`](../type-aliases/Parser.md)\<`number`, `U`\>

Defined in: [src/parsers/number.ts:27](https://github.com/zeixcom/le-truc/blob/e2435e222ab83bf3d7406922f98523eb60eae450/src/parsers/number.ts#L27)

Parse a string as a number forced to integer with a fallback

Supports hexadecimal and scientific notation

## Type Parameters

### U

`U` *extends* [`UI`](../type-aliases/UI.md)

## Parameters

### fallback?

[`Fallback`](../type-aliases/Fallback.md)\<`number`, `U`\> = `0`

Fallback value or reader function

## Returns

[`Parser`](../type-aliases/Parser.md)\<`number`, `U`\>

Parser function

## Since

0.11.0
