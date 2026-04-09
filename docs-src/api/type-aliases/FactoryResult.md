### Type Alias: FactoryResult

> **FactoryResult** = ([`EffectDescriptor`](EffectDescriptor.md) \| `false` \| `undefined`)[]

Defined in: [src/effects.ts:41](https://github.com/zeixcom/le-truc/blob/a45b49e21f141d0d53e4b986d3d37f6b090780f6/src/effects.ts#L41)

The return value of the factory function.

A flat array of effect descriptors (and optional falsy guards for conditional
effects). Falsy values (`false`, `undefined`) are filtered out before activation,
enabling the `element && watch(...)` conditional pattern.
