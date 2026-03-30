### Function: asMethod()

> **asMethod**\<`T`\>(`fn`): `T` & `object`

Defined in: [src/parsers.ts:127](https://github.com/zeixcom/le-truc/blob/84654ba213d2f93af20025001d10957b6f1486c9/src/parsers.ts#L127)

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
