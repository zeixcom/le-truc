### Type Alias: FirstElement

> **FirstElement** = \{\<`S`\>(`selector`, `required`): [`ElementFromSelector`](ElementFromSelector.md)\<`S`\>; \<`S`\>(`selector`): [`ElementFromSelector`](ElementFromSelector.md)\<`S`\> \| `undefined`; \<`E`\>(`selector`, `required`): `E`; \<`E`\>(`selector`): `E` \| `undefined`; \}

Defined in: [src/helpers/dom.ts:92](https://github.com/zeixcom/le-truc/blob/7e0fa7978a962570b404d9891000511e41ab8eb9/src/helpers/dom.ts#L92)

#### Call Signature

> \<`S`\>(`selector`, `required`): [`ElementFromSelector`](ElementFromSelector.md)\<`S`\>

##### Type Parameters

###### S

`S` *extends* `string`

##### Parameters

###### selector

`S`

###### required

`string`

##### Returns

[`ElementFromSelector`](ElementFromSelector.md)\<`S`\>

#### Call Signature

> \<`S`\>(`selector`): [`ElementFromSelector`](ElementFromSelector.md)\<`S`\> \| `undefined`

##### Type Parameters

###### S

`S` *extends* `string`

##### Parameters

###### selector

`S`

##### Returns

[`ElementFromSelector`](ElementFromSelector.md)\<`S`\> \| `undefined`

#### Call Signature

> \<`E`\>(`selector`, `required`): `E`

##### Type Parameters

###### E

`E` *extends* `Element`

##### Parameters

###### selector

`string`

###### required

`string`

##### Returns

`E`

#### Call Signature

> \<`E`\>(`selector`): `E` \| `undefined`

##### Type Parameters

###### E

`E` *extends* `Element`

##### Parameters

###### selector

`string`

##### Returns

`E` \| `undefined`
