### Type Alias: KnownTag\<S\>

> **KnownTag**\<`S`\> = `Lowercase`\<[`ExtractTag`](ExtractTag.md)\<`S`\>\> *extends* keyof `HTMLElementTagNameMap` \| keyof `SVGElementTagNameMap` \| keyof `MathMLElementTagNameMap` ? `Lowercase`\<[`ExtractTag`](ExtractTag.md)\<`S`\>\> : `never`

Defined in: [src/ui.ts:49](https://github.com/zeixcom/le-truc/blob/e24d2793804f24d536ad713492cc94d3689bbbde/src/ui.ts#L49)

#### Type Parameters

##### S

`S` *extends* `string`
