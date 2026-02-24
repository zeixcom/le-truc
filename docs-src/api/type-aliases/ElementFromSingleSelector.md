### Type Alias: ElementFromSingleSelector\<S\>

> **ElementFromSingleSelector**\<`S`\> = [`KnownTag`](KnownTag.md)\<`S`\> *extends* `never` ? `HTMLElement` : [`KnownTag`](KnownTag.md)\<`S`\> *extends* keyof `HTMLElementTagNameMap` ? `HTMLElementTagNameMap`\[[`KnownTag`](KnownTag.md)\<`S`\>\] : [`KnownTag`](KnownTag.md)\<`S`\> *extends* keyof `SVGElementTagNameMap` ? `SVGElementTagNameMap`\[[`KnownTag`](KnownTag.md)\<`S`\>\] : [`KnownTag`](KnownTag.md)\<`S`\> *extends* keyof `MathMLElementTagNameMap` ? `MathMLElementTagNameMap`\[[`KnownTag`](KnownTag.md)\<`S`\>\] : `HTMLElement`

Defined in: [src/ui.ts:65](https://github.com/zeixcom/le-truc/blob/62f34241868753829f1b0628a59b7cbc4dc09d76/src/ui.ts#L65)

#### Type Parameters

##### S

`S` *extends* `string`
