### Type Alias: EffectDescriptor

> **EffectDescriptor** = () => [`MaybeCleanup`](MaybeCleanup.md)

Defined in: [src/effects.ts:31](https://github.com/zeixcom/le-truc/blob/41c579cf74dea25346deb2e44ba0238619c3dcd3/src/effects.ts#L31)

A deferred effect: a thunk that, when called inside a reactive scope, creates
a reactive effect and returns an optional cleanup function.

Effect descriptors are returned by `run()`, `on()`, `each()`, `pass()`, and
`provideContexts()`. They are activated after dependency resolution, not
immediately when the factory function runs.

#### Returns

[`MaybeCleanup`](MaybeCleanup.md)
