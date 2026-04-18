### Type Alias: ProvideContextsHelper\<P\>

> **ProvideContextsHelper**\<`P`\> = (`contexts`) => [`EffectDescriptor`](EffectDescriptor.md)

Defined in: [src/context.ts:56](https://github.com/zeixcom/le-truc/blob/f8dbc86585fb0a5dd6f0ac2867231d04b1cf7d6c/src/context.ts#L56)

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
