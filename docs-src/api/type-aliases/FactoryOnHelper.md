### Type Alias: FactoryOnHelper\<P\>

> **FactoryOnHelper**\<`P`\> = \{\<`E`, `T`\>(`target`, `type`, `handler`, `options?`): [`EffectDescriptor`](EffectDescriptor.md); \<`E`\>(`target`, `type`, `handler`, `options?`): [`EffectDescriptor`](EffectDescriptor.md); \<`E`, `T`\>(`target`, `type`, `handler`, `options?`): [`EffectDescriptor`](EffectDescriptor.md); \<`E`\>(`target`, `type`, `handler`, `options?`): [`EffectDescriptor`](EffectDescriptor.md); \}

Defined in: [src/component.ts:136](https://github.com/zeixcom/le-truc/blob/f9b8cffe5799acfab716409be9dfb516ce44d8c2/src/component.ts#L136)

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

`E`

###### type

`T`

###### handler

(`event`, `element`) => `void` \| \{ \[K in string \| number \| symbol\]?: P\[K\] \}

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

`E`

###### type

`string`

###### handler

(`event`, `element`) => `void` \| \{ \[K in string \| number \| symbol\]?: P\[K\] \}

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

[`Memo`](Memo.md)\<`E`[]\>

###### type

`T`

###### handler

(`event`, `element`) => `void` \| \{ \[K in string \| number \| symbol\]?: P\[K\] \}

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

[`Memo`](Memo.md)\<`E`[]\>

###### type

`string`

###### handler

(`event`, `element`) => `void` \| \{ \[K in string \| number \| symbol\]?: P\[K\] \}

###### options?

`AddEventListenerOptions`

##### Returns

[`EffectDescriptor`](EffectDescriptor.md)
