### Type Alias: Initializers\<P\>

> **Initializers**\<`P`\> = \{ \[K in keyof P\]?: P\[K\] \| Signal\<P\[K\]\> \| Parser\<P\[K\]\> \| MethodProducer \}

Defined in: [src/component.ts:69](https://github.com/zeixcom/le-truc/blob/30c663d93493e8bfde66b92544a0c454cb99d1a1/src/component.ts#L69)

The `props` argument of `defineComponent` — a map from property names to their initializers.

Each value may be:
- A **static value** or **`Signal`** — used directly as the initial signal value.
- A **`Parser`** (branded with `asParser()`) — called with the attribute value string
  at connect time.
- A **`MethodProducer`** (branded with `defineMethod()`) — assigned directly as the property
  value; the function IS the method. Per-instance state lives in factory scope.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)
