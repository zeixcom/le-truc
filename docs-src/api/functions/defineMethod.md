### Function: defineMethod()

> **defineMethod**\<`T`\>(`fn`): `T` & `object`

Defined in: [src/types.ts:148](https://github.com/zeixcom/le-truc/blob/30c663d93493e8bfde66b92544a0c454cb99d1a1/src/types.ts#L148)

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
