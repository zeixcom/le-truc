### Type Alias: PassHelper\<P\>

> **PassHelper**\<`P`\> = \{\<`Q`\>(`target`, `props`): [`EffectDescriptor`](EffectDescriptor.md); \<`Q`\>(`target`, `props`): [`EffectDescriptor`](EffectDescriptor.md); \}

Defined in: [src/effects.ts:129](https://github.com/zeixcom/le-truc/blob/61a4980d5c6f404aabf340d018832f060d2545fc/src/effects.ts#L129)

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

[`Falsy`](Falsy.md) \| `HTMLElement` & `Q`

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

[`Falsy`](Falsy.md) \| [`Memo`](Memo.md)\<`HTMLElement` & `Q`[]\>

###### props

[`PassedProps`](PassedProps.md)\<`P`, `Q`\>

##### Returns

[`EffectDescriptor`](EffectDescriptor.md)
