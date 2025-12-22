[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / Initializers

# Type Alias: Initializers\<P, U\>

> **Initializers**\<`P`, `U`\> = \{ \[K in keyof P\]?: P\[K\] \| Signal\<P\[K\]\> \| Parser\<P\[K\], ComponentUI\<P, U\>\> \| Reader\<MaybeSignal\<P\[K\]\>, ComponentUI\<P, U\>\> \| MethodProducer\<P, ComponentUI\<P, U\>\> \}

Defined in: [src/component.ts:52](https://github.com/zeixcom/le-truc/blob/e2435e222ab83bf3d7406922f98523eb60eae450/src/component.ts#L52)

## Type Parameters

### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

### U

`U` *extends* [`UI`](UI.md)
