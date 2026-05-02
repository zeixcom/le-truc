### Type Alias: OnHelper\<P\>

> **OnHelper**\<`P`\> = \{\<`E`, `T`\>(`target`, `type`, `handler`, `options?`): [`EffectDescriptor`](EffectDescriptor.md); \<`E`\>(`target`, `type`, `handler`, `options?`): [`EffectDescriptor`](EffectDescriptor.md); \<`E`, `T`\>(`target`, `type`, `handler`, `options?`): [`EffectDescriptor`](EffectDescriptor.md); \<`E`\>(`target`, `type`, `handler`, `options?`): [`EffectDescriptor`](EffectDescriptor.md); \}

Defined in: [src/helpers/events.ts:39](https://github.com/zeixcom/le-truc/blob/3f0de1fb7379c829fde242331bee0885b56a8cd8/src/helpers/events.ts#L39)

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
