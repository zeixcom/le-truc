### Function: each()

#### Call Signature

> **each**\<`E`\>(`memo`, `callback`): [`EffectDescriptor`](../type-aliases/EffectDescriptor.md)

Defined in: [src/effects.ts:351](https://github.com/zeixcom/le-truc/blob/a45b49e21f141d0d53e4b986d3d37f6b090780f6/src/effects.ts#L351)

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

Defined in: [src/effects.ts:355](https://github.com/zeixcom/le-truc/blob/a45b49e21f141d0d53e4b986d3d37f6b090780f6/src/effects.ts#L355)

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
