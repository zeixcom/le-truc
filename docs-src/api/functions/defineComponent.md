[**@zeix/le-truc**](../README.md)

***

[@zeix/le-truc](../globals.md) / defineComponent

# Function: defineComponent()

> **defineComponent**\<`P`, `U`\>(`name`, `props?`, `select?`, `setup?`): [`Component`](../type-aliases/Component.md)\<`P`\>

Defined in: [src/component.ts:81](https://github.com/zeixcom/le-truc/blob/755557440db1d4332483c0516277bf183e3ff944/src/component.ts#L81)

Define a component with dependency resolution and setup function (connectedCallback)

## Type Parameters

### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

### U

`U` *extends* [`UI`](../type-aliases/UI.md) = \{ \}

## Parameters

### name

`string`

Custom element name

### props?

[`Initializers`](../type-aliases/Initializers.md)\<`P`, `U`\> = `...`

Component properties

### select?

(`elementQueries`) => `U`

Function to select UI elements

### setup?

(`ui`) => [`Effects`](../type-aliases/Effects.md)\<`P`, [`ComponentUI`](../type-aliases/ComponentUI.md)\<`P`, `U`\>\>

Setup function

## Returns

[`Component`](../type-aliases/Component.md)\<`P`\>

## Since

0.15.0

## Throws

If component name is invalid

## Throws

If property name is invalid
