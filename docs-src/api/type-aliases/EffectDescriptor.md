### Type Alias: EffectDescriptor

> **EffectDescriptor** = () => [`MaybeCleanup`](MaybeCleanup.md)

Defined in: [src/types.ts:76](https://github.com/zeixcom/le-truc/blob/7e0fa7978a962570b404d9891000511e41ab8eb9/src/types.ts#L76)

A deferred effect: a thunk that, when called inside a reactive scope, creates
a reactive effect and returns an optional cleanup function.

Effect descriptors are returned by `watch()`, `on()`, `each()`, `pass()`, and
`provideContexts()`. They are activated after dependency resolution, not
immediately when the factory function runs.

#### Returns

[`MaybeCleanup`](MaybeCleanup.md)
