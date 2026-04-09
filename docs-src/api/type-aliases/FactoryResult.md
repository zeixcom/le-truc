### Type Alias: FactoryResult

> **FactoryResult** = ([`EffectDescriptor`](EffectDescriptor.md) \| `false` \| `undefined`)[]

Defined in: [src/effects.ts:41](https://github.com/zeixcom/le-truc/blob/31e7cc1b8e62c6f8981bd8a73ff42a136ac376b1/src/effects.ts#L41)

The return value of the factory function.

A flat array of effect descriptors (and optional falsy guards for conditional
effects). Falsy values (`false`, `undefined`) are filtered out before activation,
enabling the `element && watch(...)` conditional pattern.
