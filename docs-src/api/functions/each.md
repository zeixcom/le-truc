### Function: each()

#### Call Signature

> **each**\<`E`\>(`memo`, `callback`): [`EffectDescriptor`](../type-aliases/EffectDescriptor.md)

Defined in: [src/effects.ts:376](https://github.com/zeixcom/le-truc/blob/715e9bd5c4e382082b6ddd7a0cf9768da5f33744/src/effects.ts#L376)

Create per-element reactive effects from a `Memo<Element[]>`.

When elements enter the collection, their effects are created in a per-element
scope; when they leave, their effects are disposed with that scope.

The callback receives a single element and returns a `FactoryResult` (array of
`EffectDescriptor`s) or a single `EffectDescriptor` (single-descriptor shortcut).
Falsy values can also be returned to skip conditionally.

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

Defined in: [src/effects.ts:380](https://github.com/zeixcom/le-truc/blob/715e9bd5c4e382082b6ddd7a0cf9768da5f33744/src/effects.ts#L380)

Create per-element reactive effects from a `Memo<Element[]>`.

When elements enter the collection, their effects are created in a per-element
scope; when they leave, their effects are disposed with that scope.

The callback receives a single element and returns a `FactoryResult` (array of
`EffectDescriptor`s) or a single `EffectDescriptor` (single-descriptor shortcut).
Falsy values can also be returned to skip conditionally.

##### Type Parameters

###### E

`E` *extends* `Element`

##### Parameters

###### memo

[`Memo`](../type-aliases/Memo.md)\<`E`[]\>

###### callback

(`element`) => [`Falsy`](../type-aliases/Falsy.md) \| [`EffectDescriptor`](../type-aliases/EffectDescriptor.md)

##### Returns

[`EffectDescriptor`](../type-aliases/EffectDescriptor.md)

##### Since

2.0
