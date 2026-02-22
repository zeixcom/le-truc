### Type Alias: KnownTag\<S\>

> **KnownTag**\<`S`\> = `Lowercase`\<[`ExtractTag`](ExtractTag.md)\<`S`\>\> *extends* keyof `HTMLElementTagNameMap` \| keyof `SVGElementTagNameMap` \| keyof `MathMLElementTagNameMap` ? `Lowercase`\<[`ExtractTag`](ExtractTag.md)\<`S`\>\> : `never`

Defined in: [src/ui.ts:49](https://github.com/zeixcom/le-truc/blob/ce6fdde33897d7e14382a222c2fdd5e1804c6bd3/src/ui.ts#L49)

#### Type Parameters

##### S

`S` *extends* `string`
