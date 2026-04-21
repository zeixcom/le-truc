### Type Alias: EffectDescriptor

> **EffectDescriptor** = () => [`MaybeCleanup`](MaybeCleanup.md)

Defined in: [src/effects.ts:36](https://github.com/zeixcom/le-truc/blob/3d378e339ca819861372f356f408d3d000b2c62c/src/effects.ts#L36)

A deferred effect: a thunk that, when called inside a reactive scope, creates
a reactive effect and returns an optional cleanup function.

Effect descriptors are returned by `watch()`, `on()`, `each()`, `pass()`, and
`provideContexts()`. They are activated after dependency resolution, not
immediately when the factory function runs.

#### Returns

[`MaybeCleanup`](MaybeCleanup.md)
