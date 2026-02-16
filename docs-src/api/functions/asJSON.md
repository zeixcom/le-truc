[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / asJSON

# Function: asJSON()

> **asJSON**\<`T`, `U`\>(`fallback`): [`Parser`](../type-aliases/Parser.md)\<`T`, `U`\>

Defined in: [src/parsers/json.ts:14](https://github.com/zeixcom/le-truc/blob/9067b0df4b01434796accabfb262c9896f05f14f/src/parsers/json.ts#L14)

Parse a string as a JSON serialized object with a fallback

## Type Parameters

### T

`T` *extends* `object`

### U

`U` *extends* [`UI`](../type-aliases/UI.md)

## Parameters

### fallback

[`Fallback`](../type-aliases/Fallback.md)\<`T`, `U`\>

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
