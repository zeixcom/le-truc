### Type Alias: Initializers\<P\>

> **Initializers**\<`P`\> = \{ \[K in keyof P\]?: P\[K\] \| Signal\<P\[K\]\> \| Parser\<P\[K\]\> \| Reader\<MaybeSignal\<P\[K\]\>, HTMLElement & P\> \| (P\[K\] extends (args: any\[\]) =\> any ? P\[K\] & \{ \[METHOD\_BRAND\]: true \} : never) \}

Defined in: [src/component.ts:76](https://github.com/zeixcom/le-truc/blob/f9b8cffe5799acfab716409be9dfb516ce44d8c2/src/component.ts#L76)

The `props` argument of `defineComponent` — a map from property names to their initializers.

Each value may be:
- A **static value** or **`Signal`** — used directly as the initial signal value.
- A **`Parser`** (branded with `asParser()`) — called with the attribute value string
  at connect time; for 4-param form also on every attribute change.
- A **`Reader`** (one-argument function) — called with `host` at connect time; if it
  returns a function or `TaskCallback`, a computed/task signal is created; otherwise
  a mutable state signal is created.
- A **`MethodProducer`** (branded with `asMethod()`) — assigned directly as the property
  value; the function IS the method. Per-instance state lives in factory scope.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)
