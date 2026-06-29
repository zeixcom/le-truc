### Type Alias: PassHelper\<P\>

> **PassHelper**\<`P`\> = \{\<`Q`\>(`target`, `props`): [`EffectDescriptor`](EffectDescriptor.md); \<`Q`\>(`target`, `props`): [`EffectDescriptor`](EffectDescriptor.md); \}

Defined in: [src/helpers/reactive.ts:127](https://github.com/zeixcom/le-truc/blob/f973c77449aa2054ba6f6324004d6f4dfb8706d1/src/helpers/reactive.ts#L127)

The `pass` helper type in `FactoryContext`.

Passes reactive values to a descendant Le Truc component's Slot-backed signals.
Supports single-element and Memo targets (per-element lifecycle for Memo).

The property-key (`'value'`) and bare-writable-signal (`someState`) forms are
deprecated — they hand the child unrestricted `.set()` on the parent's signal
(ADR-0012) and warn in DEV_MODE. Migrate to the behavior-preserving descriptor:

```ts
// before (deprecated) — child can write freely
pass(child, { value: parentSignal })
// after — child writes are mediated by the parent
pass(child, { value: { get: parentSignal.get, set: parentSignal.set } })
```

For read-only access use the thunk: `pass(child, { value: () => host.value })`.
Both deprecated forms are removed in the next major.

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
