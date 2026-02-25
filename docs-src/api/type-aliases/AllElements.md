### Type Alias: AllElements()

> **AllElements** = \{\<`S`\>(`selector`, `required?`): [`Memo`](Memo.md)\<[`ElementFromSelector`](ElementFromSelector.md)\<`S`\>[]\>; \<`E`\>(`selector`, `required?`): [`Memo`](Memo.md)\<`E`[]\>; \}

Defined in: [src/ui.ts:95](https://github.com/zeixcom/le-truc/blob/a92b4399bad64857b5ce4a84d167b4b3258577af/src/ui.ts#L95)

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
