### Function: each()

> **each**\<`E`\>(`memo`, `callback`): [`EffectDescriptor`](../type-aliases/EffectDescriptor.md)

Defined in: [src/helpers/reactive.ts:355](https://github.com/zeixcom/le-truc/blob/157db2ea6a0d3aea197ee178eec89f5cb4064479/src/helpers/reactive.ts#L355)

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

(`element`) => [`Falsy`](../type-aliases/Falsy.md) \| [`EffectDescriptor`](../type-aliases/EffectDescriptor.md) \| [`FactoryResult`](../type-aliases/FactoryResult.md)

#### Returns

[`EffectDescriptor`](../type-aliases/EffectDescriptor.md)

#### Since

2.0
