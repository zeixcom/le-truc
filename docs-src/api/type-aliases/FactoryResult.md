### Type Alias: FactoryResult

> **FactoryResult** = ([`EffectDescriptor`](EffectDescriptor.md) \| `false` \| `undefined`)[]

Defined in: [src/effects.ts:40](https://github.com/zeixcom/le-truc/blob/6e56893b2946c17dd4fe36c76f1a09d8d1d02488/src/effects.ts#L40)

The return value of the factory function.

A flat array of effect descriptors (and optional falsy guards for conditional
effects). Falsy values (`false`, `undefined`) are filtered out before activation,
enabling the `element && run(...)` conditional pattern.
