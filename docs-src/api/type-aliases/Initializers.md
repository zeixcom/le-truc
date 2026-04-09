### Type Alias: Initializers\<P\>

> **Initializers**\<`P`\> = \{ \[K in keyof P\]?: P\[K\] \| Signal\<P\[K\]\> \| Parser\<P\[K\]\> \| (P\[K\] extends (args: any\[\]) =\> any ? P\[K\] & \{ \[METHOD\_BRAND\]: true \} : never) \}

Defined in: [src/component.ts:73](https://github.com/zeixcom/le-truc/blob/a45b49e21f141d0d53e4b986d3d37f6b090780f6/src/component.ts#L73)

The `props` argument of `defineComponent` — a map from property names to their initializers.

Each value may be:
- A **static value** or **`Signal`** — used directly as the initial signal value.
- A **`Parser`** (branded with `asParser()`) — called with the attribute value string
  at connect time; for 4-param form also on every attribute change.
- A **`MethodProducer`** (branded with `defineMethod()`) — assigned directly as the property
  value; the function IS the method. Per-instance state lives in factory scope.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)
