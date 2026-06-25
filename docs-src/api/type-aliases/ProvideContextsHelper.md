### Type Alias: ProvideContextsHelper\<P\>

> **ProvideContextsHelper**\<`P`\> = (`contexts`) => [`EffectDescriptor`](EffectDescriptor.md)

Defined in: [src/helpers/context.ts:56](https://github.com/zeixcom/le-truc/blob/db6b1a1848573cd9da112abcb4d5e3ad31b37308/src/helpers/context.ts#L56)

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
