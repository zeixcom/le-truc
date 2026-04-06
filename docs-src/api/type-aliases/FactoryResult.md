### Type Alias: FactoryResult

> **FactoryResult** = ([`EffectDescriptor`](EffectDescriptor.md) \| `false` \| `undefined`)[]

Defined in: [src/effects.ts:38](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/effects.ts#L38)

The return value of the v1.1 factory function.

A flat array of effect descriptors (and optional falsy guards for conditional
effects). Falsy values (`false`, `undefined`) are filtered out before activation,
enabling the `element && run(...)` conditional pattern.
