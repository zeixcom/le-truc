[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / ElementFromKey

# Type Alias: ElementFromKey\<U, K\>

> **ElementFromKey**\<`U`, `K`\> = `NonNullable`\<`U`\[`K`\] *extends* [`Collection`](Collection.md)\<infer E\> ? `E` : `U`\[`K`\] *extends* `Element` ? `U`\[`K`\] : `never`\>

Defined in: [src/ui.ts:97](https://github.com/zeixcom/le-truc/blob/18042e4c4fbfc3b2f2479cf6ec1867dbaa7b7796/src/ui.ts#L97)

## Type Parameters

### U

`U` *extends* [`UI`](UI.md)

### K

`K` *extends* keyof `U`
