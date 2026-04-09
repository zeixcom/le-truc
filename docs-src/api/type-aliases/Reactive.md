### Type Alias: Reactive\<T, P\>

> **Reactive**\<`T`, `P`\> = keyof `P` \| [`Signal`](Signal.md)\<`T` & `object`\> \| (() => `T` \| `Promise`\<`T`\> \| `null` \| `undefined`)

Defined in: [src/effects.ts:64](https://github.com/zeixcom/le-truc/blob/41c579cf74dea25346deb2e44ba0238619c3dcd3/src/effects.ts#L64)

A reactive value that drives a DOM update or a slot injection.

Three forms are accepted:
- `keyof P` — a string property name on the host; reads `host[name]` and
  registers it as a signal dependency automatically.
- `Signal<T>` — any signal; `.get()` is called inside the reactive effect.
- `() => T | Promise<T> | null | undefined` — a thunk wrapped in `createComputed`;
  all signals read inside are tracked in the pure phase. Returning `null` or
  `undefined` drives the `nil` path; an async thunk becomes a `Task` signal.

#### Type Parameters

##### T

`T`

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)
