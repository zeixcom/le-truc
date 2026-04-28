### Type Alias: OnHelper\<P\>

> **OnHelper**\<`P`\> = \{\<`E`, `T`\>(`target`, `type`, `handler`, `options?`): [`EffectDescriptor`](EffectDescriptor.md); \<`E`\>(`target`, `type`, `handler`, `options?`): [`EffectDescriptor`](EffectDescriptor.md); \<`E`, `T`\>(`target`, `type`, `handler`, `options?`): [`EffectDescriptor`](EffectDescriptor.md); \<`E`\>(`target`, `type`, `handler`, `options?`): [`EffectDescriptor`](EffectDescriptor.md); \}

Defined in: [src/events.ts:40](https://github.com/zeixcom/le-truc/blob/787595f49d798a36c251c9a03383a3033b77ac2b/src/events.ts#L40)

`on` helper bound to a component host. Accepts a single element or `Memo<E[]>` target
and typed event names. Returns an `EffectDescriptor`.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

#### Call Signature

> \<`E`, `T`\>(`target`, `type`, `handler`, `options?`): [`EffectDescriptor`](EffectDescriptor.md)

##### Type Parameters

###### E

`E` *extends* `Element`

###### T

`T` *extends* keyof `HTMLElementEventMap`

##### Parameters

###### target

[`Falsy`](Falsy.md) \| [`Memo`](Memo.md)\<`E`[]\>

###### type

`T`

###### handler

[`OnEventHandler`](OnEventHandler.md)\<`P`, `HTMLElementEventMap`\[`T`\], `E`\>

###### options?

`AddEventListenerOptions`

##### Returns

[`EffectDescriptor`](EffectDescriptor.md)

#### Call Signature

> \<`E`\>(`target`, `type`, `handler`, `options?`): [`EffectDescriptor`](EffectDescriptor.md)

##### Type Parameters

###### E

`E` *extends* `Element`

##### Parameters

###### target

[`Falsy`](Falsy.md) \| [`Memo`](Memo.md)\<`E`[]\>

###### type

`string`

###### handler

[`OnEventHandler`](OnEventHandler.md)\<`P`, `Event`, `E`\>

###### options?

`AddEventListenerOptions`

##### Returns

[`EffectDescriptor`](EffectDescriptor.md)

#### Call Signature

> \<`E`, `T`\>(`target`, `type`, `handler`, `options?`): [`EffectDescriptor`](EffectDescriptor.md)

##### Type Parameters

###### E

`E` *extends* `Element`

###### T

`T` *extends* keyof `HTMLElementEventMap`

##### Parameters

###### target

[`Falsy`](Falsy.md) \| `E`

###### type

`T`

###### handler

[`OnEventHandler`](OnEventHandler.md)\<`P`, `HTMLElementEventMap`\[`T`\], `E`\>

###### options?

`AddEventListenerOptions`

##### Returns

[`EffectDescriptor`](EffectDescriptor.md)

#### Call Signature

> \<`E`\>(`target`, `type`, `handler`, `options?`): [`EffectDescriptor`](EffectDescriptor.md)

##### Type Parameters

###### E

`E` *extends* `Element`

##### Parameters

###### target

[`Falsy`](Falsy.md) \| `E`

###### type

`string`

###### handler

[`OnEventHandler`](OnEventHandler.md)\<`P`, `Event`, `E`\>

###### options?

`AddEventListenerOptions`

##### Returns

[`EffectDescriptor`](EffectDescriptor.md)
