### Type Alias: AllElements

> **AllElements** = \{\<`S`\>(`selector`, `required?`): [`Memo`](Memo.md)\<[`ElementFromSelector`](ElementFromSelector.md)\<`S`\>[]\>; \<`E`\>(`selector`, `required?`): [`Memo`](Memo.md)\<`E`[]\>; \}

Defined in: [src/ui.ts:95](https://github.com/zeixcom/le-truc/blob/64495a8246bdcc3ad970b9cd968208c864711df0/src/ui.ts#L95)

#### Call Signature

> \<`S`\>(`selector`, `required?`): [`Memo`](Memo.md)\<[`ElementFromSelector`](ElementFromSelector.md)\<`S`\>[]\>

##### Type Parameters

###### S

`S` *extends* `string`

##### Parameters

###### selector

`S`

###### required?

`string`

##### Returns

[`Memo`](Memo.md)\<[`ElementFromSelector`](ElementFromSelector.md)\<`S`\>[]\>

#### Call Signature

> \<`E`\>(`selector`, `required?`): [`Memo`](Memo.md)\<`E`[]\>

##### Type Parameters

###### E

`E` *extends* `Element`

##### Parameters

###### selector

`string`

###### required?

`string`

##### Returns

[`Memo`](Memo.md)\<`E`[]\>
