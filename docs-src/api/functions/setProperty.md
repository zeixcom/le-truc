[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / setProperty

# Function: setProperty()

> **setProperty**\<`P`, `E`, `K`\>(`key`, `reactive`): [`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Defined in: [src/effects/property.ts:16](https://github.com/zeixcom/le-truc/blob/278ab0df3fbdca5f6b0f0436bf1688626c821080/src/effects/property.ts#L16)

Effect for setting a property on an element.
Sets the specified property directly on the element object.

## Type Parameters

### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

### E

`E` *extends* `Element`

### K

`K` *extends* `string`

## Parameters

### key

`K`

Name of the property to set

### reactive

[`Reactive`](../type-aliases/Reactive.md)\<`E`\[`K`\] & `object`, `P`, `E`\> = `...`

Reactive value bound to the property value (defaults to property name)

## Returns

[`Effect`](../type-aliases/Effect.md)\<`P`, `E`\>

Effect function that sets the property on the element

## Since

0.8.0
