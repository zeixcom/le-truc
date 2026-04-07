### Function: each()

#### Call Signature

> **each**\<`E`\>(`memo`, `callback`): [`EffectDescriptor`](../type-aliases/EffectDescriptor.md)

Defined in: [src/effects.ts:345](https://github.com/zeixcom/le-truc/blob/6e56893b2946c17dd4fe36c76f1a09d8d1d02488/src/effects.ts#L345)

Create per-element reactive effects from a `Memo<Element[]>`.

When elements enter the collection, their effects are created in a per-element
scope; when they leave, their effects are disposed with that scope.

The callback receives a single element and returns a `FactoryResult` (array of
`EffectDescriptor`s) or a single `EffectDescriptor` (single-descriptor shortcut).

##### Type Parameters

###### E

`E` *extends* `Element`

##### Parameters

###### memo

[`Memo`](../type-aliases/Memo.md)\<`E`[]\>

###### callback

(`element`) => [`FactoryResult`](../type-aliases/FactoryResult.md)

##### Returns

[`EffectDescriptor`](../type-aliases/EffectDescriptor.md)

##### Since

2.0

#### Call Signature

> **each**\<`E`\>(`memo`, `callback`): [`EffectDescriptor`](../type-aliases/EffectDescriptor.md)

Defined in: [src/effects.ts:349](https://github.com/zeixcom/le-truc/blob/6e56893b2946c17dd4fe36c76f1a09d8d1d02488/src/effects.ts#L349)

Create per-element reactive effects from a `Memo<Element[]>`.

When elements enter the collection, their effects are created in a per-element
scope; when they leave, their effects are disposed with that scope.

The callback receives a single element and returns a `FactoryResult` (array of
`EffectDescriptor`s) or a single `EffectDescriptor` (single-descriptor shortcut).

##### Type Parameters

###### E

`E` *extends* `Element`

##### Parameters

###### memo

[`Memo`](../type-aliases/Memo.md)\<`E`[]\>

###### callback

(`element`) => [`EffectDescriptor`](../type-aliases/EffectDescriptor.md)

##### Returns

[`EffectDescriptor`](../type-aliases/EffectDescriptor.md)

##### Since

2.0
