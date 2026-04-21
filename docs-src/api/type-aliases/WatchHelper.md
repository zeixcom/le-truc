### Type Alias: WatchHelper\<P\>

> **WatchHelper**\<`P`\> = \{\<`K`\>(`source`, `handler`): [`EffectDescriptor`](EffectDescriptor.md); \<`K`\>(`source`, `handlers`): [`EffectDescriptor`](EffectDescriptor.md); \<`T`\>(`source`, `handler`): [`EffectDescriptor`](EffectDescriptor.md); \<`T`\>(`source`, `handlers`): [`EffectDescriptor`](EffectDescriptor.md); \<`T`\>(`source`, `handler`): [`EffectDescriptor`](EffectDescriptor.md); \<`T`\>(`source`, `handlers`): [`EffectDescriptor`](EffectDescriptor.md); (`source`, `handler`): [`EffectDescriptor`](EffectDescriptor.md); \}

Defined in: [src/effects.ts:83](https://github.com/zeixcom/le-truc/blob/56101c7b29abec1b313b7eb357a8db22a4da0ef6/src/effects.ts#L83)

The `watch` helper type in `FactoryContext`.

Drives a reactive effect from a signal source (property name, Signal, thunk,
or array). Only the declared sources trigger re-runs — incidental reads inside
the handler are not tracked. Returns an `EffectDescriptor`.

Thunk form `() => T` is wrapped in `createComputed`, so all signals read inside
it are tracked in the pure phase — useful for deriving or transforming values
before the side-effectful handler runs.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

#### Call Signature

> \<`K`\>(`source`, `handler`): [`EffectDescriptor`](EffectDescriptor.md)

##### Type Parameters

###### K

`K` *extends* `string`

##### Parameters

###### source

`K`

###### handler

(`value`) => [`MaybePromise`](MaybePromise.md)\<[`MaybeCleanup`](MaybeCleanup.md)\>

##### Returns

[`EffectDescriptor`](EffectDescriptor.md)

#### Call Signature

> \<`K`\>(`source`, `handlers`): [`EffectDescriptor`](EffectDescriptor.md)

##### Type Parameters

###### K

`K` *extends* `string`

##### Parameters

###### source

`K`

###### handlers

[`SingleMatchHandlers`](SingleMatchHandlers.md)\<`P`\[`K`\]\>

##### Returns

[`EffectDescriptor`](EffectDescriptor.md)

#### Call Signature

> \<`T`\>(`source`, `handler`): [`EffectDescriptor`](EffectDescriptor.md)

##### Type Parameters

###### T

`T` *extends* `object`

##### Parameters

###### source

[`Signal`](Signal.md)\<`T`\>

###### handler

(`value`) => [`MaybePromise`](MaybePromise.md)\<[`MaybeCleanup`](MaybeCleanup.md)\>

##### Returns

[`EffectDescriptor`](EffectDescriptor.md)

#### Call Signature

> \<`T`\>(`source`, `handlers`): [`EffectDescriptor`](EffectDescriptor.md)

##### Type Parameters

###### T

`T` *extends* `object`

##### Parameters

###### source

[`Signal`](Signal.md)\<`T`\>

###### handlers

[`SingleMatchHandlers`](SingleMatchHandlers.md)\<`T`\>

##### Returns

[`EffectDescriptor`](EffectDescriptor.md)

#### Call Signature

> \<`T`\>(`source`, `handler`): [`EffectDescriptor`](EffectDescriptor.md)

##### Type Parameters

###### T

`T` *extends* `object`

##### Parameters

###### source

() => `T` \| `Promise`\<`T`\> \| `null` \| `undefined`

###### handler

(`value`) => [`MaybePromise`](MaybePromise.md)\<[`MaybeCleanup`](MaybeCleanup.md)\>

##### Returns

[`EffectDescriptor`](EffectDescriptor.md)

#### Call Signature

> \<`T`\>(`source`, `handlers`): [`EffectDescriptor`](EffectDescriptor.md)

##### Type Parameters

###### T

`T` *extends* `object`

##### Parameters

###### source

() => `T` \| `Promise`\<`T`\> \| `null` \| `undefined`

###### handlers

[`SingleMatchHandlers`](SingleMatchHandlers.md)\<`T`\>

##### Returns

[`EffectDescriptor`](EffectDescriptor.md)

#### Call Signature

> (`source`, `handler`): [`EffectDescriptor`](EffectDescriptor.md)

##### Parameters

###### source

[`Reactive`](Reactive.md)\<\{ \}, `P`\>[]

###### handler

(`values`) => [`MaybePromise`](MaybePromise.md)\<[`MaybeCleanup`](MaybeCleanup.md)\>

##### Returns

[`EffectDescriptor`](EffectDescriptor.md)
