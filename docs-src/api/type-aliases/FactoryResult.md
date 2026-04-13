### Type Alias: FactoryResult

> **FactoryResult** = ([`EffectDescriptor`](EffectDescriptor.md) \| `FactoryResult` \| [`Falsy`](Falsy.md))[]

Defined in: [src/effects.ts:46](https://github.com/zeixcom/le-truc/blob/351fe6de1fcacfd814112a86c890ce84f0ea57f3/src/effects.ts#L46)

The return value of the factory function.

An array of effect descriptors (and optional falsy guards for conditional
effects). Nested arrays are automatically flattened. Falsy values (`false`,
`undefined`, `null`, `""`, `0`) are filtered out before activation, enabling the
`element && [watch(...)]` conditional pattern.
