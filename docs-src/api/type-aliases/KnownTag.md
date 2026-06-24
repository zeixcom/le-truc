### Type Alias: KnownTag\<S\>

> **KnownTag**\<`S`\> = `Lowercase`\<[`ExtractTag`](ExtractTag.md)\<`S`\>\> *extends* keyof `HTMLElementTagNameMap` \| keyof `SVGElementTagNameMap` \| keyof `MathMLElementTagNameMap` ? `Lowercase`\<[`ExtractTag`](ExtractTag.md)\<`S`\>\> : `never`

Defined in: [src/helpers/dom.ts:56](https://github.com/zeixcom/le-truc/blob/f51edaae2ea1b2c30e1cd0bb4defc26c33ce055e/src/helpers/dom.ts#L56)

#### Type Parameters

##### S

`S` *extends* `string`
