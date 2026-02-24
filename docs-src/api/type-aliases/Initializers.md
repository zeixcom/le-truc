### Type Alias: Initializers\<P, U\>

> **Initializers**\<`P`, `U`\> = \{ \[K in keyof P\]?: P\[K\] \| Signal\<P\[K\]\> \| Parser\<P\[K\], ComponentUI\<P, U\>\> \| Reader\<MaybeSignal\<P\[K\]\>, ComponentUI\<P, U\>\> \| ((ui: ComponentUI\<P, U\>) =\> void) \}

Defined in: [src/component.ts:49](https://github.com/zeixcom/le-truc/blob/216682a13a682782a7a31b91ce98c0ec9f53511a/src/component.ts#L49)

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### U

`U` *extends* [`UI`](UI.md)
