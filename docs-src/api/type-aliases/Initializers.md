### Type Alias: Initializers\<P, U\>

> **Initializers**\<`P`, `U`\> = \{ \[K in keyof P\]?: P\[K\] \| Signal\<P\[K\]\> \| Parser\<P\[K\], ComponentUI\<P, U\>\> \| Reader\<MaybeSignal\<P\[K\]\>, ComponentUI\<P, U\>\> \| ((ui: ComponentUI\<P, U\>) =\> void) \}

Defined in: [src/component.ts:50](https://github.com/zeixcom/le-truc/blob/23167c4de345bf28cd627a58ae4ea4e29243c54c/src/component.ts#L50)

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### U

`U` *extends* [`UI`](UI.md)
