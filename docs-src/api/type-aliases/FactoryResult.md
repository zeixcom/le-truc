### Type Alias: FactoryResult

> **FactoryResult** = ([`EffectDescriptor`](EffectDescriptor.md) \| `false` \| `undefined`)[]

Defined in: [src/effects.ts:27](https://github.com/zeixcom/le-truc/blob/f9b8cffe5799acfab716409be9dfb516ce44d8c2/src/effects.ts#L27)

The return value of the factory function.

A flat array of effect descriptors (and optional falsy guards for conditional
effects). Falsy values (`false`, `undefined`) are filtered out before activation,
enabling the `element && run(...)` conditional pattern.
