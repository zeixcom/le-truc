### Type Alias: Initializers\<P, U\>

> **Initializers**\<`P`, `U`\> = \{ \[K in keyof P\]?: P\[K\] \| Signal\<P\[K\]\> \| Parser\<P\[K\], ComponentUI\<P, U\>\> \| Reader\<MaybeSignal\<P\[K\]\>, ComponentUI\<P, U\>\> \| ((ui: ComponentUI\<P, U\>) =\> void) \}

Defined in: [src/component.ts:49](https://github.com/zeixcom/le-truc/blob/a92b4399bad64857b5ce4a84d167b4b3258577af/src/component.ts#L49)

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

##### U

`U` *extends* [`UI`](UI.md)
