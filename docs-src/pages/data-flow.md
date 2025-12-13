---
title: 'Data Flow'
emoji: '🔄'
description: 'Passing state, events, context'
---

<section-hero>

# 🔄 Data Flow

<div>
  <p class="lead"><strong>Learn how Le Truc components can work together seamlessly.</strong> Start with simple parent-child relationships, then explore advanced patterns like custom events and shared state. Build modular, loosely coupled components that communicate efficiently.</p>
  {{ toc }}
</div>
</section-hero>

<section>

## Component Coordination

Let's consider a **product catalog** where users can add items to a shopping cart. We have **three independent components** that work together:

- `ModuleCatalog` **(Parent)**:
  - **Tracks all `SpinButton` components** in its subtree and calculates the total count of items in the shopping cart.
  - **Passes that total** to a `BasicButton`.
- `BasicButton` **(Child)**:
  - Displays a **badge** in the top-right corner when the `badge` property is set.
  - **Does not track any state** – it simply renders whatever value is passed to it.
- `FormSpinbutton` **(Child)**:
  - Displays an **Add to Cart** button initially.
  - When an item is added, it transforms into a **stepper** (increment/decrement buttons).

Although `BasicButton` and `FormSpinbutton` are completely independent, they need to work together. So `ModuleCatalog` **coordinates the data flow between them**.

### Parent Component: ModuleCatalog

The **parent component (`ModuleCatalog`) knows about its children**, meaning it can **read state from and pass state to** them.

First, we need to observe the quantities of all `FormSpinbutton` components. For this, we create a `Collection` of all children matching the `form-spinbutton` selector using the `all` function:

```js (module-catalog.js)
defineComponent(
	'module-catalog',
	{},
	({ all, first }) => ({
		button: first('basic-button', 'Add a button to go go the Shopping Cart'),
		spinbuttons: all(
			'form-spinbutton',
			'Add spinbutton components to calculate sum from.',
		),
	}),
	ui => {
		// Component setup
	},
)
```

In contrast to a static `querySelectorAll()` call, the `Collection` signal returned by `all()` is reactive and updates whenever new elements are added or removed from the DOM.

Then, we need to convert the total of all product quantities to a string and pass it on to the `BasicButton` component. In Le Truc we use the `pass()` function to share state with descendant components:

```js (module-catalog.js)
defineComponent(
	'module-catalog',
	{},
	({ all, first }) => ({
		button: first('basic-button', 'Add a button to go go the Shopping Cart'),
		spinbuttons: all(
			'form-spinbutton',
			'Add spinbutton components to calculate sum from.',
		),
	}),
	({ spinbuttons }) => {
		const total = createComputed(() =>
			spinbuttons.get().reduce((sum, item) => sum + item.value, 0),
		)
		return {
			button: [
				pass({
					disabled: () => !total.get(),
					badge: () => (total.get() > 0 ? String(total.get()) : ''),
				}),
			],
		}
	},
)
```

Allright, that's it!

- Whenever one of the `value` signals of a `<form-spinbutton>` updates, the total in the badge of `<basic-button>` automatically updates.
- No need for event listeners or manual updates!

### Child Component: BasicButton

The `BasicButton` component **displays a badge when needed** – it does not know about any other component nor track state itself. It just exposes a reactive properties `badge` of type `string` and `disabled` of type `boolean` and has effects to react to state changes that updates the DOM subtree.

```js (basic-button.js)
defineComponent(
	'basic-button',
	{
		disabled: asBoolean(),
		badge: asString(ui => ui.badge?.textContent ?? ''),
	},
	({ first }) => ({
		button: first('button', 'Add a native button as descendant.'),
		badge: first('span.badge'),
	}),
	() => ({
		button: [setProperty('disabled')],
		badge: [setText('badge')],
	}),
)
```

- Whenever the `disabled` property is updated by a parent component, the button is disabled or enabled.
- Whenever the `badge` property is updated by a parent component, the badge text updates.
- If `badge` is an empty string, the badge indicator is hidden (via CSS).

### Child Component: FormSpinbutton

The `FormSpinbutton` component reacts to user interactions and exposes a reactive property `value` of type `number`. It updates its own internal DOM subtree, but doesn't know about any other component nor where the value is used.

```js (form-spinbutton.js)
defineComponent(
	'form-spinbutton',
	{
		value: createSensor(
			read(ui => ui.input.value, asInteger()),
			'controls',
			{
				change: ({ ui, target, prev }) => {
					if (!(target instanceof HTMLInputElement)) return prev

					const resetTo = (next: number) => {
						target.value = String(next)
						target.checkValidity()
						return next
					}

					const next = Number(target.value)
					if (!Number.isInteger(next)) return resetTo(prev)
					const clamped = Math.min(ui.host.max, Math.max(0, next))
					if (next !== clamped) return resetTo(clamped)
					return clamped
				},
				click: ({ target, prev }) =>
					prev +
					(target.classList.contains('decrement')
						? -1
						: target.classList.contains('increment')
							? 1
							: 0),
				keydown: ({ ui, event, prev }) => {
					const { key } = event
					if (['ArrowUp', 'ArrowDown', '-', '+'].includes(key)) {
						event.stopPropagation()
						event.preventDefault()
						const next = prev + (key === 'ArrowDown' || key === '-' ? -1 : 1)
						return Math.min(ui.host.max, Math.max(0, next))
					}
				},
			},
		),
		max: read(ui => ui.input.max, asInteger(10)),
	},
	({ all, first }) => ({
		controls: all(
			'button, input:not([disabled])',
		),
		increment: first(
			'button.increment',
			'Add a native button to increment the value',
		),
		decrement: first(
			'button.decrement',
			'Add a native button to decrement the value',
		),
		input: first('input.value', 'Add a native input to display the value'),
		zero: first('.zero'),
		other: first('.other'),
	}),
	({ host, increment, zero }) => {
		const nonZero = createComputed(() => host.value !== 0)
		const incrementLabel = increment.ariaLabel || 'Increment'
		const ariaLabel = createComputed(() =>
			nonZero.get() || !zero ? incrementLabel : zero.textContent,
		)

		return {
			input: [
				show(nonZero),
				setProperty('value'),
				setProperty('max', () => String(host.max)),
			],
			decrement: [show(nonZero)],
			increment: [
				setProperty('disabled', () => host.value >= host.max),
				setProperty('ariaLabel', ariaLabel),
			],
			zero: [show(() => !nonZero.get())],
			other: [show(nonZero)],
		}
	},
)
```

- Whenever the user clicks a button or presses a handled key, the value property is updated.
- The component sets hidden and disabled states of buttons and updates the text of the `input` element.

### Full Example

Here's how everything comes together:

- Each `FormSpinbutton` tracks its own value.
- The `ModuleCatalog` sums all quantities and passes the total to `BasicButton`.
- The `BasicButton` displays the total if it's greater than zero.

**No custom events are needed – state flows naturally!**

<module-demo>
	<div class="preview">
  	<module-catalog>
  		<header>
  			<p>Shop</p>
  			<basic-button disabled>
  				<button type="button" disabled>
  					<span class="label">🛒 Shopping Cart</span>
  					<span class="badge"></span>
  				</button>
  			</basic-button>
  		</header>
  		<ul>
  			<li>
  				<p>Product 1</p>
  				<form-spinbutton>
  					<button type="button" class="decrement" aria-label="Decrement" hidden>
  						−
  					</button>
  					<input
  						type="number"
  						class="value"
  						name="amount-product1"
  						value="0"
  						min="0"
  						max="10"
  						readonly
  						disabled
  						hidden
  					/>
  					<button type="button" class="increment" aria-label="Increment">
  						<span class="zero">Add to Cart</span>
  						<span class="other" hidden>+</span>
  					</button>
  				</form-spinbutton>
  			</li>
  			<li>
  				<p>Product 2</p>
  				<form-spinbutton>
  					<button type="button" class="decrement" aria-label="Decrement" hidden>
  						−
  					</button>
  					<input
  						type="number"
  						class="value"
  						name="amount-product2"
  						value="0"
  						min="0"
  						max="5"
  						readonly
  						disabled
  						hidden
  					/>
  					<button type="button" class="increment" aria-label="Increment">
  						<span class="zero">Add to Cart</span>
  						<span class="other" hidden>+</span>
  					</button>
  				</form-spinbutton>
  			</li>
  			<li>
  				<p>Product 3</p>
  				<form-spinbutton>
  					<button type="button" class="decrement" aria-label="Decrement" hidden>
  						−
  					</button>
  					<input
  						type="number"
  						class="value"
  						name="amount-product3"
  						value="0"
  						min="0"
  						max="20"
  						readonly
  						disabled
  						hidden
  					/>
  					<button type="button" class="increment" aria-label="Increment">
  						<span class="zero">Add to Cart</span>
  						<span class="other" hidden>+</span>
  					</button>
  				</form-spinbutton>
  			</li>
  		</ul>
    </module-catalog>
	</div>
	<details>
		<summary>ModuleCatalog Source Code</summary>
		<module-lazyload src="./examples/module-catalog.html">
			<card-callout>
				<p class="loading" role="status" aria-live="polite">Loading...</p>
				<p class="error" role="alert" aria-live="assertive" hidden></p>
			</card-callout>
			<div class="content"></div>
		</module-lazy>
	</details>
	<details>
		<summary>BasicButton Source Code</summary>
		<module-lazyload src="./examples/basic-button.html">
			<card-callout>
				<p class="loading" role="status" aria-live="polite">Loading...</p>
				<p class="error" role="alert" aria-live="assertive" hidden></p>
			</card-callout>
			<div class="content"></div>
		</module-lazy>
	</details>
	<details>
		<summary>FormSpinbutton Source Code</summary>
		<module-lazyload src="./examples/form-spinbutton.html">
			<card-callout>
				<p class="loading" role="status" aria-live="polite">Loading...</p>
				<p class="error" role="alert" aria-live="asserive" hidden></p>
			</card-callout>
			<div class="content"></div>
		</module-lazy>
	</details>
</module-demo>

</section>

<section>

## Providing Context

Context allows **parent components to share state** with any descendant components in the DOM tree, **without prop drilling**. This is perfect for application-wide settings like user preferences, theme data, or authentication state.

### Creating Context Keys

First, define typed context keys for the values you want to share:

```ts
// Define context keys with types
const USER_THEME = 'user-theme' as Context<
  'user-theme',
  State<'light' | 'dark'>
>
const USER_LANGUAGE = 'user-language' as Context<'user-language', State<string>>
const USER_SETTINGS = 'user-settings' as Context<
  'user-settings',
  State<UserSettings>
>

// Type for user settings
type UserSettings = {
  notifications: boolean
  autoSave: boolean
  fontSize: 'small' | 'medium' | 'large'
}
```

### Provider Component

The **provider component** creates the shared state and makes it available to descendants:

```js
component(
  'user-preferences',
  {
    // Create reactive state for each context
    [USER_THEME]: () => {
      const savedTheme = localStorage.getItem('theme') || 'light'
      const theme = state(savedTheme)

      // Persist changes to localStorage
      theme.subscribe(value => {
        localStorage.setItem('theme', value)
        document.documentElement.setAttribute('data-theme', value)
      })

      return theme
    },

    [USER_LANGUAGE]: () => {
      const savedLang = localStorage.getItem('language') || 'en'
      const language = state(savedLang)

      language.subscribe(value => {
        localStorage.setItem('language', value)
        document.documentElement.setAttribute('lang', value)
      })

      return language
    },

    [USER_SETTINGS]: () => {
      const defaultSettings = {
        notifications: true,
        autoSave: true,
        fontSize: 'medium',
      }

      const saved = localStorage.getItem('userSettings')
      const initial = saved ? JSON.parse(saved) : defaultSettings
      const settings = state(initial)

      settings.subscribe(value => {
        localStorage.setItem('userSettings', JSON.stringify(value))
      })

      return settings
    },
  },
  () => [
    // Provide all contexts to descendant components
    provideContexts([USER_THEME, USER_LANGUAGE, USER_SETTINGS]),
  ],
)
```

### TypeScript Support

For full type safety and autocompletion, declare your contexts globally:

```ts
export type UserPreferencesProps = {
  'user-theme': 'light' | 'dark'
  'user-language': string
  'user-settings': UserSettings
}

declare global {
  interface HTMLElementTagNameMap {
    'user-preferences': Component<UserPreferencesProps>
  }
}
```

### Usage in HTML

The provider component wraps your entire application or a section that needs shared state:

```html
<user-preferences>
  <header>
    <theme-toggle></theme-toggle>
    <language-selector></language-selector>
  </header>

  <main>
    <settings-panel></settings-panel>
    <content-area></content-area>
  </main>
</user-preferences>
```

**Key Benefits:**

- **Centralized State**: All user preferences managed in one place
- **Automatic Persistence**: Changes automatically saved to localStorage
- **Type Safety**: Full TypeScript support with autocomplete
- **Reactive Updates**: All consumers automatically update when context changes
- **No Prop Drilling**: Deep components access context directly

</section>

<section>

## Consuming Context

**Consumer components** use `fromContext()` to access shared state from ancestor providers. The context is automatically reactive - when the provider updates the context, all consumers update immediately.

### Simple Context Consumer

Here's a theme toggle that consumes and updates the user theme context:

```js
component(
  'theme-toggle',
  {
    // Consume the theme context with fallback
    theme: fromContext(USER_THEME, 'light'),
  },
  (el, { first }) => [
    first('button', [
      setText(() => (el.theme === 'light' ? '🌙 Dark' : '☀️ Light')),
      setProperty(
        'ariaLabel',
        () => `Switch to ${el.theme === 'light' ? 'dark' : 'light'} theme`,
      ),
      on('click', () => {
        // Update the context - all consumers will react
        el.theme = el.theme === 'light' ? 'dark' : 'light'
      }),
    ]),
  ],
)
```

### Complex Context Consumer

A settings panel that consumes and modifies user settings:

```js
component(
  'settings-panel',
  {
    // Consume multiple contexts
    theme: fromContext(USER_THEME, 'light'),
    language: fromContext(USER_LANGUAGE, 'en'),
    settings: fromContext(USER_SETTINGS, {
      notifications: true,
      autoSave: true,
      fontSize: 'medium',
    }),
  },
  (el, { all, first }) => {
    return [
      // Theme section
      first('.theme-setting', [setText(() => `Current theme: ${el.theme}`)]),

      first('.theme-buttons button[data-theme="light"]', [
        toggleClass('active', () => el.theme === 'light'),
        on('click', () => {
          el.theme = 'light'
        }),
      ]),

      first('.theme-buttons button[data-theme="dark"]', [
        toggleClass('active', () => el.theme === 'dark'),
        on('click', () => {
          el.theme = 'dark'
        }),
      ]),

      // Language selection
      first('select[name="language"]', [
        setProperty('value', 'language'),
        on('change', e => {
          el.language = e.target.value
        }),
      ]),

      // Settings toggles
      first('input[name="notifications"]', [
        setProperty('checked', () => el.settings.notifications),
        on('change', e => {
          el.settings = {
            ...el.settings,
            notifications: e.target.checked,
          }
        }),
      ]),

      first('input[name="autoSave"]', [
        setProperty('checked', () => el.settings.autoSave),
        on('change', e => {
          el.settings = {
            ...el.settings,
            autoSave: e.target.checked,
          }
        }),
      ]),

      // Font size selector
      all('input[name="fontSize"]', [
        setProperty('checked', target => el.settings.fontSize === target.value),
        on('change', e => {
          el.settings = {
            ...el.settings,
            fontSize: e.target.value,
          }
        }),
      ]),
    ]
  },
)
```

### Context with Computed Values

You can also use context to provide computed values derived from multiple sources:

```js
component(
  'user-status',
  {
    theme: fromContext(USER_THEME, 'light'),
    settings: fromContext(USER_SETTINGS, { fontSize: 'medium' }),

    // Computed property based on context
    statusMessage: el =>
      `Theme: ${el.theme}, Font: ${el.settings.fontSize}, Notifications: ${el.settings.notifications ? 'on' : 'off'}`,
  },
  (el, { first }) => [first('.status', setText('statusMessage'))],
)
```

### Context with Fallback Functions

For more complex fallback logic, use a function:

```js
component(
  'localized-content',
  {
    language: fromContext(USER_LANGUAGE, el => {
      // Fallback logic: detect browser language or use 'en'
      return navigator.language.split('-')[0] || 'en'
    }),
  },
  (el, { first }) => [
    first(
      '.greeting',
      setText(() => {
        const greetings = {
          en: 'Hello!',
          es: '¡Hola!',
          fr: 'Bonjour!',
          de: 'Hallo!',
        }
        return greetings[el.language] || greetings.en
      }),
    ),
  ],
)
```

### Benefits of Context

- **Automatic Updates**: All consumers react when context changes
- **Type Safety**: Full TypeScript support with proper typing
- **Fallback Support**: Graceful degradation when context is unavailable
- **Performance**: Only components that use changed context re-render
- **Clean Architecture**: Eliminates prop drilling and tight coupling

**When to Use Context:**

- **Application State**: User preferences, authentication, theme
- **Configuration**: API endpoints, feature flags, environment settings
- **Shared Resources**: Database connections, cache instances
- **Cross-cutting Concerns**: Logging, analytics, error handling

</section>

<section>

## Next Steps

</section>
