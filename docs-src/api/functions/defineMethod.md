### Function: defineMethod()

> **defineMethod**\<`T`\>(`fn`): `T` & `object`

Defined in: [src/parsers.ts:67](https://github.com/zeixcom/le-truc/blob/c06fbd9800df065e7a4d81949422b458792c2deb/src/parsers.ts#L67)

Brand a custom method-producer function with the `METHOD_BRAND` symbol.

Use this to wrap any side-effect initializer so `isMethodProducer()` can
identify it explicitly rather than relying on the absence of a return value.

#### Type Parameters

##### T

`T` *extends* (...`args`) => `void`

#### Parameters

##### fn

`T`

Side-effect initializer to brand

#### Returns

`T` & `object`

The same function, branded as a `MethodProducer`

#### Since

0.16.2
