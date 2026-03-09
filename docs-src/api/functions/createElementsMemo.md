### Function: createElementsMemo()

#### Call Signature

> **createElementsMemo**\<`S`\>(`parent`, `selector`): [`Memo`](../type-aliases/Memo.md)\<[`ElementFromSelector`](../type-aliases/ElementFromSelector.md)\<`S`\>[]\>

Defined in: [src/ui.ts:168](https://github.com/zeixcom/le-truc/blob/d8168684fc4cb8d811d0fffec6f48f3c78b3f3fb/src/ui.ts#L168)

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

Reactive memo of current matching elements

##### Since

0.16.0

#### Call Signature

> **createElementsMemo**\<`E`\>(`parent`, `selector`): [`Memo`](../type-aliases/Memo.md)\<`E`[]\>

Defined in: [src/ui.ts:172](https://github.com/zeixcom/le-truc/blob/d8168684fc4cb8d811d0fffec6f48f3c78b3f3fb/src/ui.ts#L172)

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

Reactive memo of current matching elements

##### Since

0.16.0
