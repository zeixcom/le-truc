### Type Alias: KnownTag\<S\>

> **KnownTag**\<`S`\> = `Lowercase`\<[`ExtractTag`](ExtractTag.md)\<`S`\>\> *extends* keyof `HTMLElementTagNameMap` \| keyof `SVGElementTagNameMap` \| keyof `MathMLElementTagNameMap` ? `Lowercase`\<[`ExtractTag`](ExtractTag.md)\<`S`\>\> : `never`

Defined in: [src/helpers/dom.ts:56](https://github.com/zeixcom/le-truc/blob/8b1a8f8a0600ebb21b0e3c25fa43e088d951188e/src/helpers/dom.ts#L56)

#### Type Parameters

##### S

`S` *extends* `string`
