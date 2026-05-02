### Type Alias: KnownTag\<S\>

> **KnownTag**\<`S`\> = `Lowercase`\<[`ExtractTag`](ExtractTag.md)\<`S`\>\> *extends* keyof `HTMLElementTagNameMap` \| keyof `SVGElementTagNameMap` \| keyof `MathMLElementTagNameMap` ? `Lowercase`\<[`ExtractTag`](ExtractTag.md)\<`S`\>\> : `never`

Defined in: [src/helpers/dom.ts:56](https://github.com/zeixcom/le-truc/blob/157db2ea6a0d3aea197ee178eec89f5cb4064479/src/helpers/dom.ts#L56)

#### Type Parameters

##### S

`S` *extends* `string`
