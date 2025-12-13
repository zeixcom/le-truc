[**le-truc**](../README.md)

***

[le-truc](../globals.md) / asNumber

# Function: asNumber()

> **asNumber**\<`U`\>(`fallback?`): [`Parser`](../type-aliases/Parser.md)\<`number`, `U`\>

Defined in: [src/parsers/number.ts:51](https://github.com/zeixcom/le-truc/blob/30bbcb8816f11237e187c4d8786237ece7d23841/src/parsers/number.ts#L51)

Parse a string as a number with a fallback

## Type Parameters

### U

`U` *extends* [`UI`](../type-aliases/UI.md)

## Parameters

### fallback?

`Fallback`\<`number`, `U`\> = `0`

Fallback value or reader function

## Returns

[`Parser`](../type-aliases/Parser.md)\<`number`, `U`\>

Parser function

## Since

0.11.0
