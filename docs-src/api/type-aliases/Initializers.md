### Type Alias: Initializers\<P, U\>

> **Initializers**\<`P`, `U`\> = \{ \[K in keyof P\]?: P\[K\] \| Signal\<P\[K\]\> \| Parser\<P\[K\], ComponentUI\<P, U\>\> \| Reader\<MaybeSignal\<P\[K\]\>, ComponentUI\<P, U\>\> \| ((ui: ComponentUI\<P, U\>) =\> void) \}

Defined in: [src/component.ts:80](https://github.com/zeixcom/le-truc/blob/ecfd71ac3d27d86bcfc647fabb6e10e7d9f11413/src/component.ts#L80)

The `props` argument of `defineComponent` — a map from property names to their initializers.

Each value may be:
- A **static value** or **`Signal`** — used directly as the initial signal value.
- A **`Parser`** (two-argument function branded with `asParser()`) — called with
  `(ui, attributeValue)` at connect time and again on every attribute change.
- A **`Reader`** (one-argument function) — called with `ui` at connect time; if it
  returns a function or `TaskCallback`, a computed/task signal is created; otherwise
  a mutable state signal is created.
- A **`MethodProducer`** (branded with `asMethod()`) — called for side effect of
  creating the method only; its return value is ignored.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### U

`U` *extends* [`UI`](UI.md)
