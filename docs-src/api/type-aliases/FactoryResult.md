### Type Alias: FactoryResult

> **FactoryResult** = ([`EffectDescriptor`](EffectDescriptor.md) \| `FactoryResult` \| [`Falsy`](Falsy.md))[]

Defined in: [src/types.ts:86](https://github.com/zeixcom/le-truc/blob/a00a78f0ec81c853d59278f25a4fb2f3f3684691/src/types.ts#L86)

The return value of the factory function.

An array of effect descriptors (and optional falsy guards for conditional
effects). Nested arrays are automatically flattened. Falsy values (`false`,
`undefined`, `null`, `""`, `0`) are filtered out before activation, enabling the
`element && [watch(...)]` conditional pattern.
