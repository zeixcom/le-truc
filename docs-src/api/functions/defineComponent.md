### Function: defineComponent()

> **defineComponent**\<`P`, `U`\>(`name`, `props?`, `select?`, `setup?`): [`Component`](../type-aliases/Component.md)\<`P`\>

Defined in: [src/component.ts:80](https://github.com/zeixcom/le-truc/blob/216682a13a682782a7a31b91ce98c0ec9f53511a/src/component.ts#L80)

Define and register a reactive custom element.

Calls `customElements.define()` and returns the registered class.
Reactive properties are initialised in `connectedCallback` and torn down in `disconnectedCallback`.

#### Type Parameters

##### P

`P` *extends* [`ComponentProps`](../type-aliases/ComponentProps.md)

##### U

`U` *extends* [`UI`](../type-aliases/UI.md) = \{ \}

#### Parameters

##### name

`string`

Custom element name (must contain a hyphen and start with a lowercase letter)

##### props?

[`Initializers`](../type-aliases/Initializers.md)\<`P`, `U`\> = `...`

Initializers for reactive properties: static values, signals, parsers, or readers

##### select?

(`elementQueries`) => `U`

Receives `{ first, all }` query helpers; returns the UI object (queried DOM elements used by effects)

##### setup?

(`ui`) => [`Effects`](../type-aliases/Effects.md)\<`P`, [`ComponentUI`](../type-aliases/ComponentUI.md)\<`P`, `U`\>\>

Receives the frozen UI object (plus `host`) and returns effects keyed by UI element name

#### Returns

[`Component`](../type-aliases/Component.md)\<`P`\>

#### Since

0.15.0

#### Throws

If the component name is not a valid custom element name

#### Throws

If a property name conflicts with reserved words or inherited HTMLElement properties
