### Type Alias: ProvideContextsHelper\<P\>

> **ProvideContextsHelper**\<`P`\> = (`contexts`) => [`EffectDescriptor`](EffectDescriptor.md)

Defined in: [src/context.ts:56](https://github.com/zeixcom/le-truc/blob/31e7cc1b8e62c6f8981bd8a73ff42a136ac376b1/src/context.ts#L56)

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
