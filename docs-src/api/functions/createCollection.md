[**le-truc**](../README.md)

***

[le-truc](../globals.md) / createCollection

# Function: createCollection()

> **createCollection**\<`S`, `E`\>(`parent`, `selector`): [`Collection`](../interfaces/Collection.md)\<`E`\>

Defined in: [src/signals/collection.ts:68](https://github.com/zeixcom/le-truc/blob/7eb796fc51c6c6d925620eed67782e8b7b2d9151/src/signals/collection.ts#L68)

Create a collection of elements from a parent node and a CSS selector.

## Type Parameters

### S

`S` *extends* `string`

### E

`E`

## Parameters

### parent

`ParentNode`

The parent node to search within

### selector

`S`

The CSS selector to match elements

## Returns

[`Collection`](../interfaces/Collection.md)\<`E`\>

A collection signal of elements

## Since

0.15.0
