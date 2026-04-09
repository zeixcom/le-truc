### Type Alias: PassHelper\<P\>

> **PassHelper**\<`P`\> = \{\<`Q`\>(`target`, `props`): [`EffectDescriptor`](EffectDescriptor.md); \<`Q`\>(`target`, `props`): [`EffectDescriptor`](EffectDescriptor.md); \}

Defined in: [src/effects.ts:126](https://github.com/zeixcom/le-truc/blob/31e7cc1b8e62c6f8981bd8a73ff42a136ac376b1/src/effects.ts#L126)

The `pass` helper type in `FactoryContext`.

Passes reactive values to a descendant Le Truc component's Slot-backed signals.
Supports single-element and Memo targets (per-element lifecycle for Memo).

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

#### Call Signature

> \<`Q`\>(`target`, `props`): [`EffectDescriptor`](EffectDescriptor.md)

##### Type Parameters

###### Q

`Q` *extends* [`ComponentProps`](ComponentProps.md)

##### Parameters

###### target

`HTMLElement` & `Q`

###### props

[`PassedProps`](PassedProps.md)\<`P`, `Q`\>

##### Returns

[`EffectDescriptor`](EffectDescriptor.md)

#### Call Signature

> \<`Q`\>(`target`, `props`): [`EffectDescriptor`](EffectDescriptor.md)

##### Type Parameters

###### Q

`Q` *extends* [`ComponentProps`](ComponentProps.md)

##### Parameters

###### target

[`Memo`](Memo.md)\<`HTMLElement` & `Q`[]\>

###### props

[`PassedProps`](PassedProps.md)\<`P`, `Q`\>

##### Returns

[`EffectDescriptor`](EffectDescriptor.md)
