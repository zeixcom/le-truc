[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / ExtractTagFromSimpleSelector

# Type Alias: ExtractTagFromSimpleSelector\<S\>

> **ExtractTagFromSimpleSelector**\<`S`\> = `S` *extends* `` `${infer T}.${string}` `` ? `T` : `S` *extends* `` `${infer T}#${string}` `` ? `T` : `S` *extends* `` `${infer T}:${string}` `` ? `T` : `S` *extends* `` `${infer T}[${string}` `` ? `T` : `S`

Defined in: [src/ui.ts:32](https://github.com/zeixcom/le-truc/blob/755557440db1d4332483c0516277bf183e3ff944/src/ui.ts#L32)

## Type Parameters

### S

`S` *extends* `string`
