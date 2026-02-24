### Function: createElementsMemo()

#### Call Signature

> **createElementsMemo**\<`S`\>(`parent`, `selector`): [`Memo`](../type-aliases/Memo.md)\<[`ElementFromSelector`](../type-aliases/ElementFromSelector.md)\<`S`\>[]\>

Defined in: [src/ui.ts:162](https://github.com/zeixcom/le-truc/blob/cbc935087cbb74b599ebc3d8a11ba560b180d4b1/src/ui.ts#L162)

Create a memo of elements matching a CSS selector.
The MutationObserver is lazily activated when an effect first reads
the memo, and disconnected when no effects are watching.

##### Type Parameters

###### S

`S` *extends* `string`

##### Parameters

###### parent

`ParentNode`

The parent node to search within

###### selector

`S`

The CSS selector to match elements

##### Returns

[`Memo`](../type-aliases/Memo.md)\<[`ElementFromSelector`](../type-aliases/ElementFromSelector.md)\<`S`\>[]\>

A Memo of current matching elements

##### Since

0.16.0

#### Call Signature

> **createElementsMemo**\<`E`\>(`parent`, `selector`): [`Memo`](../type-aliases/Memo.md)\<`E`[]\>

Defined in: [src/ui.ts:166](https://github.com/zeixcom/le-truc/blob/cbc935087cbb74b599ebc3d8a11ba560b180d4b1/src/ui.ts#L166)

Create a memo of elements matching a CSS selector.
The MutationObserver is lazily activated when an effect first reads
the memo, and disconnected when no effects are watching.

##### Type Parameters

###### E

`E` *extends* `Element`

##### Parameters

###### parent

`ParentNode`

The parent node to search within

###### selector

`string`

The CSS selector to match elements

##### Returns

[`Memo`](../type-aliases/Memo.md)\<`E`[]\>

A Memo of current matching elements

##### Since

0.16.0
