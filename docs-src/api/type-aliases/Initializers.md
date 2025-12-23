[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / Initializers

# Type Alias: Initializers\<P, U\>

> **Initializers**\<`P`, `U`\> = \{ \[K in keyof P\]?: P\[K\] \| Signal\<P\[K\]\> \| Parser\<P\[K\], ComponentUI\<P, U\>\> \| Reader\<MaybeSignal\<P\[K\]\>, ComponentUI\<P, U\>\> \| MethodProducer\<P, ComponentUI\<P, U\>\> \}

Defined in: [src/component.ts:52](https://github.com/zeixcom/le-truc/blob/d42fb28a360f26c2ef62cbc9c1f4f11dd0f59654/src/component.ts#L52)

## Type Parameters

### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

### U

`U` *extends* [`UI`](UI.md)
