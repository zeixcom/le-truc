### Type Alias: TrimWhitespace\<S\>

> **TrimWhitespace**\<`S`\> = `S` *extends* `` ` ${infer Rest}` `` ? `TrimWhitespace`\<`Rest`\> : `S` *extends* `` `${infer Rest} ` `` ? `TrimWhitespace`\<`Rest`\> : `S`

Defined in: [src/helpers/dom.ts:17](https://github.com/zeixcom/le-truc/blob/e4b36bb40c21ae6929a612c7380070be96eead21/src/helpers/dom.ts#L17)

#### Type Parameters

##### S

`S` *extends* `string`
