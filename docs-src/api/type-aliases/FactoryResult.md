### Type Alias: FactoryResult

> **FactoryResult** = ([`EffectDescriptor`](EffectDescriptor.md) \| `false` \| `undefined`)[]

Defined in: [src/effects.ts:40](https://github.com/zeixcom/le-truc/blob/26a8f71243082cdb967941bc1640290db2bf1985/src/effects.ts#L40)

The return value of the factory function.

A flat array of effect descriptors (and optional falsy guards for conditional
effects). Falsy values (`false`, `undefined`) are filtered out before activation,
enabling the `element && run(...)` conditional pattern.
