### Type Alias: KnownTag\<S\>

> **KnownTag**\<`S`\> = `Lowercase`\<[`ExtractTag`](ExtractTag.md)\<`S`\>\> *extends* keyof `HTMLElementTagNameMap` \| keyof `SVGElementTagNameMap` \| keyof `MathMLElementTagNameMap` ? `Lowercase`\<[`ExtractTag`](ExtractTag.md)\<`S`\>\> : `never`

Defined in: [src/ui.ts:56](https://github.com/zeixcom/le-truc/blob/84654ba213d2f93af20025001d10957b6f1486c9/src/ui.ts#L56)

#### Type Parameters

##### S

`S` *extends* `string`
