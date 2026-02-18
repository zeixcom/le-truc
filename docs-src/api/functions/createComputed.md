### Function: createComputed()

#### Call Signature

> **createComputed**\<`T`\>(`callback`, `options?`): [`Task`](../type-aliases/Task.md)\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/signal.d.ts:19

Create a derived signal from existing signals

##### Type Parameters

###### T

`T` *extends* `object`

##### Parameters

###### callback

[`TaskCallback`](../type-aliases/TaskCallback.md)\<`T`\>

Computation callback function

###### options?

[`ComputedOptions`](../type-aliases/ComputedOptions.md)\<`T`\>

Optional configuration

##### Returns

[`Task`](../type-aliases/Task.md)\<`T`\>

##### Since

0.9.0

#### Call Signature

> **createComputed**\<`T`\>(`callback`, `options?`): [`Memo`](../type-aliases/Memo.md)\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/signal.d.ts:20

Create a derived signal from existing signals

##### Type Parameters

###### T

`T` *extends* `object`

##### Parameters

###### callback

[`MemoCallback`](../type-aliases/MemoCallback.md)\<`T`\>

Computation callback function

###### options?

[`ComputedOptions`](../type-aliases/ComputedOptions.md)\<`T`\>

Optional configuration

##### Returns

[`Memo`](../type-aliases/Memo.md)\<`T`\>

##### Since

0.9.0
