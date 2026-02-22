### Function: createElementsMemo()

#### Call Signature

> **createElementsMemo**\<`S`\>(`parent`, `selector`): [`Memo`](../type-aliases/Memo.md)\<[`ElementFromSelector`](../type-aliases/ElementFromSelector.md)\<`S`\>[]\>

Defined in: [src/ui.ts:155](https://github.com/zeixcom/le-truc/blob/ce6fdde33897d7e14382a222c2fdd5e1804c6bd3/src/ui.ts#L155)

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

Defined in: [src/ui.ts:159](https://github.com/zeixcom/le-truc/blob/ce6fdde33897d7e14382a222c2fdd5e1804c6bd3/src/ui.ts#L159)

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
