### Type Alias: Reactive\<T, P\>

> **Reactive**\<`T`, `P`\> = keyof `P` \| [`Signal`](Signal.md)\<`T` & `object`\> \| (() => `T` \| `Promise`\<`T`\> \| `null` \| `undefined`)

Defined in: [src/helpers/reactive.ts:48](https://github.com/zeixcom/le-truc/blob/a00a78f0ec81c853d59278f25a4fb2f3f3684691/src/helpers/reactive.ts#L48)

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
