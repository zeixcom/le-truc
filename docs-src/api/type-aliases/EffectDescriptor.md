### Type Alias: EffectDescriptor

> **EffectDescriptor** = () => [`MaybeCleanup`](MaybeCleanup.md)

Defined in: [src/effects.ts:29](https://github.com/zeixcom/le-truc/blob/2424f4ef3925d1048dd041ca1a4e10187e077e82/src/effects.ts#L29)

A deferred effect: a thunk that, when called inside a reactive scope, creates
a reactive effect and returns an optional cleanup function.

Effect descriptors are returned by `run()`, `on()`, `each()`, `pass()`, and
`provideContexts()`. They are activated after dependency resolution, not
immediately when the factory function runs.

#### Returns

[`MaybeCleanup`](MaybeCleanup.md)
