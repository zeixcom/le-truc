[**le-truc**](../README.md)

***

[le-truc](../globals.md) / Initializers

# Type Alias: Initializers\<P, U\>

> **Initializers**\<`P`, `U`\> = \{ \[K in keyof P\]?: P\[K\] \| Signal\<P\[K\]\> \| Parser\<P\[K\], ComponentUI\<P, U\>\> \| ((ui: ComponentUI\<P, U\>) =\> MaybeSignal\<P\[K\]\> \| void) \}

Defined in: [src/component.ts:48](https://github.com/zeixcom/le-truc/blob/7eb796fc51c6c6d925620eed67782e8b7b2d9151/src/component.ts#L48)

## Type Parameters

### P

`P` *extends* [`ComponentProps`](ComponentProps.md)

### U

`U` *extends* [`UI`](UI.md)
