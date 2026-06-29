### Type Alias: TrimWhitespace\<S\>

> **TrimWhitespace**\<`S`\> = `S` *extends* `` ` ${infer Rest}` `` ? `TrimWhitespace`\<`Rest`\> : `S` *extends* `` `${infer Rest} ` `` ? `TrimWhitespace`\<`Rest`\> : `S`

Defined in: [src/helpers/dom.ts:17](https://github.com/zeixcom/le-truc/blob/ef4f71291ed328572278d97a47b2febefecb314e/src/helpers/dom.ts#L17)

#### Type Parameters

##### S

`S` *extends* `string`
