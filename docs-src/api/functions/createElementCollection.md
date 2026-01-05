[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / createElementCollection

# Function: createElementCollection()

## Call Signature

> **createElementCollection**\<`S`\>(`parent`, `selector`, `keyConfig?`): `ElementCollection`\<`ElementFromSelector`\<`S`\>\>

Defined in: [src/signals/collection.ts:300](https://github.com/zeixcom/le-truc/blob/f3b75cd20fa8d2a4f346b020bc9e35faa4881fd2/src/signals/collection.ts#L300)

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

#### keyConfig?

[`KeyConfig`](../type-aliases/KeyConfig.md)\<`ElementFromSelector`\<`S`\>\>

### Returns

`ElementCollection`\<`ElementFromSelector`\<`S`\>\>

A collection signal of elements

### Since

0.15.0

## Call Signature

> **createElementCollection**\<`E`\>(`parent`, `selector`, `keyConfig?`): `ElementCollection`\<`E`\>

Defined in: [src/signals/collection.ts:305](https://github.com/zeixcom/le-truc/blob/f3b75cd20fa8d2a4f346b020bc9e35faa4881fd2/src/signals/collection.ts#L305)

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

#### keyConfig?

[`KeyConfig`](../type-aliases/KeyConfig.md)\<`E`\>

### Returns

`ElementCollection`\<`E`\>

A collection signal of elements

### Since

0.15.0
