### Type Alias: ExtractTagFromSimpleSelector\<S\>

> **ExtractTagFromSimpleSelector**\<`S`\> = `S` *extends* `` `${infer T}.${string}` `` ? `T` : `S` *extends* `` `${infer T}#${string}` `` ? `T` : `S` *extends* `` `${infer T}[${string}` `` ? `T` *extends* `` `${string}:${string}` `` ? `S` *extends* `` `${infer U}:${string}` `` ? `U` : `S` : `T` : `S` *extends* `` `${infer T}:${string}` `` ? `T` : `S`

Defined in: [src/helpers/dom.ts:39](https://github.com/zeixcom/le-truc/blob/db6b1a1848573cd9da112abcb4d5e3ad31b37308/src/helpers/dom.ts#L39)

#### Type Parameters

##### S

`S` *extends* `string`
