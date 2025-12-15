[**le-truc**](../README.md)

***

[le-truc](../globals.md) / createCollection

# Function: createCollection()

## Call Signature

> **createCollection**\<`S`\>(`parent`, `selector`): [`Collection`](../type-aliases/Collection.md)\<`ElementFromSelector`\<`S`\>\>

Defined in: [src/signals/collection.ts:67](https://github.com/zeixcom/le-truc/blob/3e8d7e7aaa7f4bbc3cb1d68aecab6664ca6352cb/src/signals/collection.ts#L67)

Create a collection of elements from a parent node and a CSS selector.

### Type Parameters

#### S

`S` *extends* `string`

### Parameters

#### parent

`ParentNode`

The parent node to search within

#### selector

`S`

The CSS selector to match elements

### Returns

[`Collection`](../type-aliases/Collection.md)\<`ElementFromSelector`\<`S`\>\>

A collection signal of elements

### Since

0.15.0

## Call Signature

> **createCollection**\<`E`\>(`parent`, `selector`): [`Collection`](../type-aliases/Collection.md)\<`E`\>

Defined in: [src/signals/collection.ts:71](https://github.com/zeixcom/le-truc/blob/3e8d7e7aaa7f4bbc3cb1d68aecab6664ca6352cb/src/signals/collection.ts#L71)

Create a collection of elements from a parent node and a CSS selector.

### Type Parameters

#### E

`E` *extends* `Element`

### Parameters

#### parent

`ParentNode`

The parent node to search within

#### selector

`string`

The CSS selector to match elements

### Returns

[`Collection`](../type-aliases/Collection.md)\<`E`\>

A collection signal of elements

### Since

0.15.0
