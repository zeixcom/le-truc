[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / ElementFromKey

# Type Alias: ElementFromKey\<U, K\>

> **ElementFromKey**\<`U`, `K`\> = `NonNullable`\<`U`\[`K`\] *extends* [`Collection`](Collection.md)\<infer E\> ? `E` : `U`\[`K`\] *extends* `Element` ? `U`\[`K`\] : `never`\>

Defined in: [src/ui.ts:97](https://github.com/zeixcom/le-truc/blob/e99be2f0bb117eaf05d9289fac0c46cf9055e672/src/ui.ts#L97)

## Type Parameters

### U

`U` *extends* [`UI`](UI.md)

### K

`K` *extends* keyof `U`
