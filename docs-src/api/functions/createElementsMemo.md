[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / createElementsMemo

# Function: createElementsMemo()

## Call Signature

> **createElementsMemo**\<`S`\>(`parent`, `selector`): [`Memo`](../type-aliases/Memo.md)\<[`ElementFromSelector`](../type-aliases/ElementFromSelector.md)\<`S`\>[]\>

Defined in: [src/ui.ts:155](https://github.com/zeixcom/le-truc/blob/d0a4e93f3ca0be0a72dba7eef0d44a002f024ef7/src/ui.ts#L155)

Create a memo of elements matching a CSS selector.
The MutationObserver is lazily activated when an effect first reads
the memo, and disconnected when no effects are watching.

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

[`Memo`](../type-aliases/Memo.md)\<[`ElementFromSelector`](../type-aliases/ElementFromSelector.md)\<`S`\>[]\>

A Memo of current matching elements

### Since

0.16.0

## Call Signature

> **createElementsMemo**\<`E`\>(`parent`, `selector`): [`Memo`](../type-aliases/Memo.md)\<`E`[]\>

Defined in: [src/ui.ts:159](https://github.com/zeixcom/le-truc/blob/d0a4e93f3ca0be0a72dba7eef0d44a002f024ef7/src/ui.ts#L159)

Create a memo of elements matching a CSS selector.
The MutationObserver is lazily activated when an effect first reads
the memo, and disconnected when no effects are watching.

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

[`Memo`](../type-aliases/Memo.md)\<`E`[]\>

A Memo of current matching elements

### Since

0.16.0
