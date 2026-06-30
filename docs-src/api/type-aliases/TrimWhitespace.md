### Type Alias: TrimWhitespace\<S\>

> **TrimWhitespace**\<`S`\> = `S` *extends* `` ` ${infer Rest}` `` ? `TrimWhitespace`\<`Rest`\> : `S` *extends* `` `${infer Rest} ` `` ? `TrimWhitespace`\<`Rest`\> : `S`

Defined in: [src/helpers/dom.ts:17](https://github.com/zeixcom/le-truc/blob/30c663d93493e8bfde66b92544a0c454cb99d1a1/src/helpers/dom.ts#L17)

#### Type Parameters

##### S

`S` *extends* `string`
