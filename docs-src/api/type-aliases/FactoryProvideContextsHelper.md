### Type Alias: FactoryProvideContextsHelper\<P\>

> **FactoryProvideContextsHelper**\<`P`\> = (`contexts`) => [`EffectDescriptor`](EffectDescriptor.md)

Defined in: [src/component.ts:192](https://github.com/zeixcom/le-truc/blob/f9b8cffe5799acfab716409be9dfb516ce44d8c2/src/component.ts#L192)

The `provideContexts` helper type in `FactoryContext`.

Attaches a `context-request` listener to the host, providing the listed
property values as context to descendant consumers. Returns an `EffectDescriptor`.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

#### Parameters

##### contexts

keyof `P`[]

#### Returns

[`EffectDescriptor`](EffectDescriptor.md)
