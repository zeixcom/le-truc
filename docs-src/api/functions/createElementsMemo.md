### Function: createElementsMemo()

#### Call Signature

> **createElementsMemo**\<`S`\>(`parent`, `selector`): [`Memo`](../type-aliases/Memo.md)\<[`ElementFromSelector`](../type-aliases/ElementFromSelector.md)\<`S`\>[]\>

Defined in: [src/helpers/dom.ts:169](https://github.com/zeixcom/le-truc/blob/30c663d93493e8bfde66b92544a0c454cb99d1a1/src/helpers/dom.ts#L169)

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

##### Throws

If the selector is malformed

#### Call Signature

> **createElementsMemo**\<`E`\>(`parent`, `selector`): [`Memo`](../type-aliases/Memo.md)\<`E`[]\>

Defined in: [src/helpers/dom.ts:173](https://github.com/zeixcom/le-truc/blob/30c663d93493e8bfde66b92544a0c454cb99d1a1/src/helpers/dom.ts#L173)

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

##### Throws

If the selector is malformed
