[**le-truc**](../README.md)

***

[le-truc](../globals.md) / asString

# Function: asString()

> **asString**\<`U`\>(`fallback?`): [`Parser`](../type-aliases/Parser.md)\<`string`, `U`\>

Defined in: [src/parsers/string.ts:12](https://github.com/zeixcom/le-truc/blob/7eb796fc51c6c6d925620eed67782e8b7b2d9151/src/parsers/string.ts#L12)

Pass through string with a fallback

## Type Parameters

### U

`U` *extends* [`UI`](../type-aliases/UI.md)

## Parameters

### fallback?

`Fallback`\<`string`, `U`\> = `''`

Fallback value or reader function

## Returns

[`Parser`](../type-aliases/Parser.md)\<`string`, `U`\>

Parser function

## Since

0.11.0
