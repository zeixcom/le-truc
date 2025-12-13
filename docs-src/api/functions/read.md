[**le-truc**](../README.md)

***

[le-truc](../globals.md) / read

# Function: read()

> **read**\<`T`, `U`\>(`reader`, `fallback`): [`Reader`](../type-aliases/Reader.md)\<`T`, `U`\>

Defined in: [src/parsers.ts:58](https://github.com/zeixcom/le-truc/blob/7eb796fc51c6c6d925620eed67782e8b7b2d9151/src/parsers.ts#L58)

Read a value from a UI element

## Type Parameters

### T

`T` *extends* `object`

### U

`U` *extends* [`UI`](../type-aliases/UI.md)

## Parameters

### reader

[`LooseReader`](../type-aliases/LooseReader.md)\<`T`, `U`\>

Reader function returning T | string | null | undefined

### fallback

`ParserOrFallback`\<`T`, `U`\>

Fallback value or parser function

## Returns

[`Reader`](../type-aliases/Reader.md)\<`T`, `U`\>

Parsed value or fallback value

## Since

0.15.0
