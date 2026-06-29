### Type Alias: FactoryResult

> **FactoryResult** = ([`EffectDescriptor`](EffectDescriptor.md) \| `FactoryResult` \| [`Falsy`](Falsy.md))[]

Defined in: [src/types.ts:86](https://github.com/zeixcom/le-truc/blob/f973c77449aa2054ba6f6324004d6f4dfb8706d1/src/types.ts#L86)

The return value of the factory function.

An array of effect descriptors (and optional falsy guards for conditional
effects). Nested arrays are automatically flattened. Falsy values (`false`,
`undefined`, `null`, `""`, `0`) are filtered out before activation, enabling the
`element && [watch(...)]` conditional pattern.
