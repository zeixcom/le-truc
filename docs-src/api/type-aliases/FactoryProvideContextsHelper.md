### Type Alias: FactoryProvideContextsHelper\<P\>

> **FactoryProvideContextsHelper**\<`P`\> = (`contexts`) => [`EffectDescriptor`](EffectDescriptor.md)

Defined in: [src/component.ts:219](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/component.ts#L219)

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
