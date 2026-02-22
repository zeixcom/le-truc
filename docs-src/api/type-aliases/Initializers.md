### Type Alias: Initializers\<P, U\>

> **Initializers**\<`P`, `U`\> = \{ \[K in keyof P\]?: P\[K\] \| Signal\<P\[K\]\> \| Parser\<P\[K\], ComponentUI\<P, U\>\> \| Reader\<MaybeSignal\<P\[K\]\>, ComponentUI\<P, U\>\> \| MethodProducer\<P, ComponentUI\<P, U\>\> \}

Defined in: [src/component.ts:53](https://github.com/zeixcom/le-truc/blob/29beeda732ab654fc5e6eab73c276e5a5367d43a/src/component.ts#L53)

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### U

`U` *extends* [`UI`](UI.md)
