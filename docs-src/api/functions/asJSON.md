[**le-truc**](../README.md)

***

[le-truc](../globals.md) / asJSON

# Function: asJSON()

> **asJSON**\<`T`, `U`\>(`fallback`): [`Parser`](../type-aliases/Parser.md)\<`T`, `U`\>

Defined in: [src/parsers/json.ts:14](https://github.com/zeixcom/le-truc/blob/30bbcb8816f11237e187c4d8786237ece7d23841/src/parsers/json.ts#L14)

Parse a string as a JSON serialized object with a fallback

## Type Parameters

### T

`T` *extends* `object`

### U

`U` *extends* [`UI`](../type-aliases/UI.md)

## Parameters

### fallback

`Fallback`\<`T`, `U`\>

Fallback value or reader function

## Returns

[`Parser`](../type-aliases/Parser.md)\<`T`, `U`\>

Parser function

## Since

0.11.0

## Throws

If the value and fallback are both null or undefined

## Throws

If value is not a valid JSON string
