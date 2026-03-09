### Type Alias: ElementFromSingleSelector\<S\>

> **ElementFromSingleSelector**\<`S`\> = [`KnownTag`](KnownTag.md)\<`S`\> *extends* `never` ? `HTMLElement` : [`KnownTag`](KnownTag.md)\<`S`\> *extends* keyof `HTMLElementTagNameMap` ? `HTMLElementTagNameMap`\[[`KnownTag`](KnownTag.md)\<`S`\>\] : [`KnownTag`](KnownTag.md)\<`S`\> *extends* keyof `SVGElementTagNameMap` ? `SVGElementTagNameMap`\[[`KnownTag`](KnownTag.md)\<`S`\>\] : [`KnownTag`](KnownTag.md)\<`S`\> *extends* keyof `MathMLElementTagNameMap` ? `MathMLElementTagNameMap`\[[`KnownTag`](KnownTag.md)\<`S`\>\] : `HTMLElement`

Defined in: [src/ui.ts:65](https://github.com/zeixcom/le-truc/blob/e8c0d32e69c325915ecdafadce2c86cae289ff85/src/ui.ts#L65)

#### Type Parameters

##### S

`S` *extends* `string`
