### Function: each()

> **each**\<`E`\>(`memo`, `callback`): [`EffectDescriptor`](../type-aliases/EffectDescriptor.md)

Defined in: [src/helpers/reactive.ts:372](https://github.com/zeixcom/le-truc/blob/db6b1a1848573cd9da112abcb4d5e3ad31b37308/src/helpers/reactive.ts#L372)

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
