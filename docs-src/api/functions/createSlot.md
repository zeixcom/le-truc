### Function: createSlot()

> **createSlot**\<`T`\>(`initialSignal`, `options?`): [`Slot`](../type-aliases/Slot.md)\<`T`\>

Defined in: node\_modules/@zeix/cause-effect/types/src/nodes/slot.d.ts:44

Creates a slot signal that delegates its value to a swappable backing signal.

A slot acts as a stable reactive source that can be used as a property descriptor
via `Object.defineProperty(target, key, slot)`. Subscribers link to the slot itself,
so replacing the backing signal with `replace()` invalidates them without breaking
existing edges. Setter calls forward to the current backing signal when it is writable.

#### Type Parameters

##### T

`T` *extends* `object`

The type of value held by the delegated signal.

#### Parameters

##### initialSignal

[`Signal`](../type-aliases/Signal.md)\<`T`\>

The initial signal to delegate to.

##### options?

[`SignalOptions`](../type-aliases/SignalOptions.md)\<`T`\>

Optional configuration for the slot.

#### Returns

[`Slot`](../type-aliases/Slot.md)\<`T`\>

A `Slot<T>` object usable both as a property descriptor and as a reactive signal.

#### Since

0.18.3
