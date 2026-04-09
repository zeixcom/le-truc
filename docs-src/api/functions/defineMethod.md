### Function: defineMethod()

> **defineMethod**\<`T`\>(`fn`): `T` & `object`

Defined in: [src/parsers.ts:69](https://github.com/zeixcom/le-truc/blob/41c579cf74dea25346deb2e44ba0238619c3dcd3/src/parsers.ts#L69)

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
