[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / asString

# Function: asString()

> **asString**\<`U`\>(`fallback?`): [`Parser`](../type-aliases/Parser.md)\<`string`, `U`\>

Defined in: [src/parsers/string.ts:12](https://github.com/zeixcom/le-truc/blob/5c30877fa2fce96dab1ef679e495da98511e97d7/src/parsers/string.ts#L12)

Pass through string with a fallback

## Type Parameters

### U

`U` *extends* [`UI`](../type-aliases/UI.md)

## Parameters

### fallback?

[`Fallback`](../type-aliases/Fallback.md)\<`string`, `U`\> = `''`

Fallback value or reader function

## Returns

[`Parser`](../type-aliases/Parser.md)\<`string`, `U`\>

Parser function

## Since

0.11.0
