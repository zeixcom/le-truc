[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / ElementFromKey

# Type Alias: ElementFromKey\<U, K\>

> **ElementFromKey**\<`U`, `K`\> = `NonNullable`\<`U`\[`K`\] *extends* [`Collection`](Collection.md)\<infer E\> ? `E` : `U`\[`K`\] *extends* `Element` ? `U`\[`K`\] : `never`\>

Defined in: [src/ui.ts:97](https://github.com/zeixcom/le-truc/blob/97c33707458c1ba34fa25436c665f488718b79cf/src/ui.ts#L97)

## Type Parameters

### U

`U` *extends* [`UI`](UI.md)

### K

`K` *extends* keyof `U`
