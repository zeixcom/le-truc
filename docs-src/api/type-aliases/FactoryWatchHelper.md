### Type Alias: FactoryWatchHelper\<P\>

> **FactoryWatchHelper**\<`P`\> = \{\<`K`\>(`source`, `handler`): [`EffectDescriptor`](EffectDescriptor.md); \<`K`\>(`source`, `handlers`): [`EffectDescriptor`](EffectDescriptor.md); \<`T`\>(`source`, `handler`): [`EffectDescriptor`](EffectDescriptor.md); \<`T`\>(`source`, `handlers`): [`EffectDescriptor`](EffectDescriptor.md); (`source`, `handler`): [`EffectDescriptor`](EffectDescriptor.md); \}

Defined in: [src/component.ts:107](https://github.com/zeixcom/le-truc/blob/f9b8cffe5799acfab716409be9dfb516ce44d8c2/src/component.ts#L107)

The `watch` helper type in `FactoryContext`.

Drives a reactive effect from a signal source (property name, Signal, or array).
Only the declared sources trigger re-runs — incidental reads inside the handler
are not tracked. Returns an `EffectDescriptor`.

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

(`value`) => [`MaybeCleanup`](MaybeCleanup.md)

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

`WatchHandlers`\<`P`\[`K`\]\>

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

(`value`) => [`MaybeCleanup`](MaybeCleanup.md)

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

`WatchHandlers`\<`T`\>

##### Returns

[`EffectDescriptor`](EffectDescriptor.md)

#### Call Signature

> (`source`, `handler`): [`EffectDescriptor`](EffectDescriptor.md)

##### Parameters

###### source

(`string` \| [`Signal`](Signal.md)\<`any`\>)[]

###### handler

(`values`) => [`MaybeCleanup`](MaybeCleanup.md)

##### Returns

[`EffectDescriptor`](EffectDescriptor.md)
