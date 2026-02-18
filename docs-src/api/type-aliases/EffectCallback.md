### Type Alias: EffectCallback()

> **EffectCallback** = () => [`MaybeCleanup`](MaybeCleanup.md)

Defined in: node\_modules/@zeix/cause-effect/types/src/graph.d.ts:112

A callback function for effects that can perform side effects.

#### Returns

[`MaybeCleanup`](MaybeCleanup.md)

An optional cleanup function that will be called before the effect re-runs or is disposed
