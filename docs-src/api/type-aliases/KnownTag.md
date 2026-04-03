### Type Alias: KnownTag\<S\>

> **KnownTag**\<`S`\> = `Lowercase`\<[`ExtractTag`](ExtractTag.md)\<`S`\>\> *extends* keyof `HTMLElementTagNameMap` \| keyof `SVGElementTagNameMap` \| keyof `MathMLElementTagNameMap` ? `Lowercase`\<[`ExtractTag`](ExtractTag.md)\<`S`\>\> : `never`

Defined in: [src/ui.ts:56](https://github.com/zeixcom/le-truc/blob/50ea304679826d6ff5a855caa1afab75729635cb/src/ui.ts#L56)

#### Type Parameters

##### S

`S` *extends* `string`
