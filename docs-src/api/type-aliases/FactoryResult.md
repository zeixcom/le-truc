### Type Alias: FactoryResult

> **FactoryResult** = ([`EffectDescriptor`](EffectDescriptor.md) \| `FactoryResult` \| [`Falsy`](Falsy.md))[]

Defined in: [src/effects.ts:46](https://github.com/zeixcom/le-truc/blob/c0c7a519683b9de6742fb7ca8d71487ad2dadceb/src/effects.ts#L46)

The return value of the factory function.

An array of effect descriptors (and optional falsy guards for conditional
effects). Nested arrays are automatically flattened. Falsy values (`false`,
`undefined`, `null`, `""`, `0`) are filtered out before activation, enabling the
`element && [watch(...)]` conditional pattern.
