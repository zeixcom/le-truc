### Type Alias: KnownTag\<S\>

> **KnownTag**\<`S`\> = `Lowercase`\<[`ExtractTag`](ExtractTag.md)\<`S`\>\> *extends* keyof `HTMLElementTagNameMap` \| keyof `SVGElementTagNameMap` \| keyof `MathMLElementTagNameMap` ? `Lowercase`\<[`ExtractTag`](ExtractTag.md)\<`S`\>\> : `never`

Defined in: [src/ui.ts:56](https://github.com/zeixcom/le-truc/blob/0b894ae96d4e011ef23dbb48c30fa71b1f97f087/src/ui.ts#L56)

#### Type Parameters

##### S

`S` *extends* `string`
