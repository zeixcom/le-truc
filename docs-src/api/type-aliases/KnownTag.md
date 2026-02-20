### Type Alias: KnownTag\<S\>

> **KnownTag**\<`S`\> = `Lowercase`\<[`ExtractTag`](ExtractTag.md)\<`S`\>\> *extends* keyof `HTMLElementTagNameMap` \| keyof `SVGElementTagNameMap` \| keyof `MathMLElementTagNameMap` ? `Lowercase`\<[`ExtractTag`](ExtractTag.md)\<`S`\>\> : `never`

Defined in: [src/ui.ts:49](https://github.com/zeixcom/le-truc/blob/b2bd37a6fe13095f4a2fd459382f54953f446e56/src/ui.ts#L49)

#### Type Parameters

##### S

`S` *extends* `string`
