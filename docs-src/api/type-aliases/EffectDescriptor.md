### Type Alias: EffectDescriptor

> **EffectDescriptor** = () => [`MaybeCleanup`](MaybeCleanup.md)

Defined in: [src/types.ts:76](https://github.com/zeixcom/le-truc/blob/30c663d93493e8bfde66b92544a0c454cb99d1a1/src/types.ts#L76)

A deferred effect: a thunk that, when called inside a reactive scope, creates
a reactive effect and returns an optional cleanup function.

Effect descriptors are returned by `watch()`, `on()`, `each()`, `pass()`, and
`provideContexts()`. They are activated after dependency resolution, not
immediately when the factory function runs.

#### Returns

[`MaybeCleanup`](MaybeCleanup.md)
