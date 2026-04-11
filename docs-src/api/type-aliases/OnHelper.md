### Type Alias: OnHelper\<P\>

> **OnHelper**\<`P`\> = \{\<`E`, `T`\>(`target`, `type`, `handler`, `options?`): [`EffectDescriptor`](EffectDescriptor.md); \<`E`\>(`target`, `type`, `handler`, `options?`): [`EffectDescriptor`](EffectDescriptor.md); \<`E`, `T`\>(`target`, `type`, `handler`, `options?`): [`EffectDescriptor`](EffectDescriptor.md); \<`E`\>(`target`, `type`, `handler`, `options?`): [`EffectDescriptor`](EffectDescriptor.md); \}

Defined in: [src/events.ts:53](https://github.com/zeixcom/le-truc/blob/4b464bcaf232e6baac491b9eb42d2a86dd71e380/src/events.ts#L53)

The `on` helper type in `FactoryContext`.

Attaches an event listener. The handler always receives `(event, element)`.
For Memo targets, uses event delegation (or per-element fallback for non-bubbling events).

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

[`Falsy`](Falsy.md) \| `E`

###### type

`T`

###### handler

(`event`, `element`) => `void` \| [`Falsy`](Falsy.md) \| \{ \[K in string \| number \| symbol\]?: P\[K\] \}

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

(`event`, `element`) => `void` \| [`Falsy`](Falsy.md) \| \{ \[K in string \| number \| symbol\]?: P\[K\] \}

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

[`Falsy`](Falsy.md) \| [`Memo`](Memo.md)\<`E`[]\>

###### type

`T`

###### handler

(`event`, `element`) => `void` \| [`Falsy`](Falsy.md) \| \{ \[K in string \| number \| symbol\]?: P\[K\] \}

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

(`event`, `element`) => `void` \| [`Falsy`](Falsy.md) \| \{ \[K in string \| number \| symbol\]?: P\[K\] \}

###### options?

`AddEventListenerOptions`

##### Returns

[`EffectDescriptor`](EffectDescriptor.md)
