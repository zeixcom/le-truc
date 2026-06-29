### Type Alias: AllElements

> **AllElements** = \{\<`S`\>(`selector`, `required?`): [`Memo`](Memo.md)\<[`ElementFromSelector`](ElementFromSelector.md)\<`S`\>[]\>; \<`E`\>(`selector`, `required?`): [`Memo`](Memo.md)\<`E`[]\>; \}

Defined in: [src/helpers/dom.ts:99](https://github.com/zeixcom/le-truc/blob/ef4f71291ed328572278d97a47b2febefecb314e/src/helpers/dom.ts#L99)

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
