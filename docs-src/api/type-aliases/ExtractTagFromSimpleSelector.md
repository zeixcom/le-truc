[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / ExtractTagFromSimpleSelector

# Type Alias: ExtractTagFromSimpleSelector\<S\>

> **ExtractTagFromSimpleSelector**\<`S`\> = `S` *extends* `` `${infer T}.${string}` `` ? `T` : `S` *extends* `` `${infer T}#${string}` `` ? `T` : `S` *extends* `` `${infer T}:${string}` `` ? `T` : `S` *extends* `` `${infer T}[${string}` `` ? `T` : `S`

Defined in: [src/ui.ts:32](https://github.com/zeixcom/le-truc/blob/c62468fd9c5d5c7240f34b9daac5034cede67a90/src/ui.ts#L32)

## Type Parameters

### S

`S` *extends* `string`
