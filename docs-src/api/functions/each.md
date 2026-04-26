### Function: each()

> **each**\<`E`\>(`memo`, `callback`): [`EffectDescriptor`](../type-aliases/EffectDescriptor.md)

Defined in: [src/effects.ts:366](https://github.com/zeixcom/le-truc/blob/9f8170c07a1296b5e43a3511bac7e4da12ade6c7/src/effects.ts#L366)

Create per-element reactive effects from a `Memo<Element[]>`.

When elements enter the collection, their effects are created in a per-element
scope; when they leave, their effects are disposed with that scope.

The callback receives a single element and returns a `FactoryResult` (array of
`EffectDescriptor`s) or a single `EffectDescriptor` (single-descriptor shortcut).
Falsy values can also be returned to skip conditionally.

#### Type Parameters

##### E

`E` *extends* `Element`

#### Parameters

##### memo

[`Memo`](../type-aliases/Memo.md)\<`E`[]\>

##### callback

(`element`) => `void` \| [`Falsy`](../type-aliases/Falsy.md) \| [`EffectDescriptor`](../type-aliases/EffectDescriptor.md) \| [`FactoryResult`](../type-aliases/FactoryResult.md)

#### Returns

[`EffectDescriptor`](../type-aliases/EffectDescriptor.md)

#### Since

2.0
