### Type Alias: ElementFromSingleSelector\<S\>

> **ElementFromSingleSelector**\<`S`\> = [`KnownTag`](KnownTag.md)\<`S`\> *extends* `never` ? `HTMLElement` : [`KnownTag`](KnownTag.md)\<`S`\> *extends* keyof `HTMLElementTagNameMap` ? `HTMLElementTagNameMap`\[[`KnownTag`](KnownTag.md)\<`S`\>\] : [`KnownTag`](KnownTag.md)\<`S`\> *extends* keyof `SVGElementTagNameMap` ? `SVGElementTagNameMap`\[[`KnownTag`](KnownTag.md)\<`S`\>\] : [`KnownTag`](KnownTag.md)\<`S`\> *extends* keyof `MathMLElementTagNameMap` ? `MathMLElementTagNameMap`\[[`KnownTag`](KnownTag.md)\<`S`\>\] : `HTMLElement`

Defined in: [src/helpers/dom.ts:69](https://github.com/zeixcom/le-truc/blob/a00a78f0ec81c853d59278f25a4fb2f3f3684691/src/helpers/dom.ts#L69)

#### Type Parameters

##### S

`S` *extends* `string`
