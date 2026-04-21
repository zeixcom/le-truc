### Type Alias: PassHelper\<P\>

> **PassHelper**\<`P`\> = \{\<`Q`\>(`target`, `props`): [`EffectDescriptor`](EffectDescriptor.md); \<`Q`\>(`target`, `props`): [`EffectDescriptor`](EffectDescriptor.md); \}

Defined in: [src/effects.ts:120](https://github.com/zeixcom/le-truc/blob/56101c7b29abec1b313b7eb357a8db22a4da0ef6/src/effects.ts#L120)

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
