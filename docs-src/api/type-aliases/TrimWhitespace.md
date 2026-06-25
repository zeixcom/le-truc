### Type Alias: TrimWhitespace\<S\>

> **TrimWhitespace**\<`S`\> = `S` *extends* `` ` ${infer Rest}` `` ? `TrimWhitespace`\<`Rest`\> : `S` *extends* `` `${infer Rest} ` `` ? `TrimWhitespace`\<`Rest`\> : `S`

Defined in: [src/helpers/dom.ts:17](https://github.com/zeixcom/le-truc/blob/9c8a9f18dddada370ee9114b563a63d53fc3734c/src/helpers/dom.ts#L17)

#### Type Parameters

##### S

`S` *extends* `string`
