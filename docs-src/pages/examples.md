---
title: 'Examples'
emoji: '🍽️'
description: 'Common use cases and demos'
layout: 'overview'
---

{% hero %}
# 🍽️ Examples & Recipes

**Discover practical examples components with Le Truc.** Each example focuses on showcasing a specific feature or best practice, guiding you through real-world use cases.
{% /hero %}

{% section %}
## Basic Components

### Button

A simple button component with a label, a disabled state, and an optional badge, intended to be controlled by a parent component.

**Tag Name**: `basic-button`

**Properties**:

- `badge`: String indicating the badge text.
- `disabled`: Boolean indicating whether the button is disabled.
- `label`: String indicating the button label.

**Elements**:

- `button`: `button`, required. `HTMLButtonElement` to with no event listener attached (controlled by a parent component).
- `badge`: `span.badge`, optional. Setting `badge` will have no effect unless the element is present.
- `label`: `span.label`, optional. Setting `label` will have no effect unless the element is present.

{% demo %}

<basic-button>
	<button type="button">
		<span class="label">🛒 Shopping Cart</span>
		<span class="badge">5</span>
	</button>
</basic-button>

---
{% sources title="Source code" src="./sources/basic-button.html" /%}
{% /demo %}

### Counter

A simple counter component with a button to increment the count and a span to display the current count.

**Tag Name**: `basic-counter`

**Properties**:

- `count`: Integer `number` indicating the current count.

**Elements**:

- `increment`: `button`, required. `HTMLButtonElement` to increment the count.
- `count`: `span`, required. `HTMLSpanElement` to display the current count.

{% demo %}

<basic-counter>
	<button type="button">💐 <span>42</span></button>
</basic-counter>

---
{% sources title="Source code" src="./sources/basic-counter.html" /%}
{% /demo %}

### Hello

A simple Hello World component with an input field to enter the name and a greeting message.

**Tag Name**: `basic-hello`

**Properties**:

- `name`: `string` indicating the name of the person to greet.

**Elements**:

- `input`: `input`, required. `HTMLInputElement` to enter the name.
- `output`: `output`, required. `HTMLOutputElement` to display the name.

{% demo %}

<basic-hello>
	<label for="name">Your name</label><br>
	<input id="name" name="name" type="text" autocomplete="given-name" />
	<p>Hello, <output for="name">World</output>!</p>
</basic-hello>

---
{% sources title="Source code" src="./sources/basic-hello.html" /%}
{% /demo %}

### Number

A simple component that displays a formatted number according to `Intl.NumberFormat` and the `lang` context for decimals, units, and currencies.

**Tag Name**: `basic-number`

**Properties**:

- `value`: `number` indicating the number to format.

**Attributes**:

- `lang`: `string` language code to use as locale. If omitted, inherited from ancestor elements.
- `options`: `JSON` options for `Intl.NumberFormat` to use.

**Elements**:

None. The formatted number is displayed directly in the host element.

{% demo %}

<basic-number lang="de-CH" value="25678.9" options='{"style":"currency","currency":"CHF"}'></basic-number>

---
{% sources title="Source code" src="./sources/basic-number.html" /%}
{% /demo %}

### Pluralize

A simple component that displays a pluralized text according to `Intl.PluralRules` and the `lang` context for different plural forms.

**Tag Name**: `basic-pluralize`

**Properties**:

- `count`: Positive integer `number` indicating the count as basis for pluralization.

**Attributes**:

- `lang`: `string` language code to use as locale. If omitted, inherited from ancestor elements.
- `ordinal`: `boolean` indicating whether to use ordinal plural rules.

**Elements**:

Arbitrary `HTMLElement`s with the following classes, that will be hidden or shown according to the plural rules that apply:

- `.count`: will hold the count value.
- `.none`: shown if count is 0.
- `.some`: shown if count is greater than 0.
- `.zero`: shown if count is 0 if locale has plural rules for zero.
- `.one`: shown if count is 1.
- `.two`: shown if count is 2 if locale has plural rules for two.
- `.few`: shown if count is few according to plural rules.
- `.many`: shown if count is many according to plural rules.
- `.other`: shown if count is other.

Depending on locales, a different set of classes may be used. For example, `new Intl.PluralRules('en').resolvedOptions().pluralCategories` only includes `one` and `other`.

{% demo %}

<basic-pluralize count="1">
	<p class="none">Nobody</p>
	<p class="some">
		<span class="count"></span>
		<span class="one">person</span>
		<span class="other">people</span>
	</p>
</basic-pluralize>

---
{% sources title="Source code" src="./sources/basic-pluralize.html" /%}
{% /demo %}

{% /section %}

{% section %}
## Card Components

### Callout

{% /section %}

{% section %}
## Context Components

### Media

{% /section %}

{% section %}
## Form Components

### Checkbox

### Combobox

### Listbox

### Radiogroup

### Spinbutton

### Textbox

{% /section %}

{% section %}
## Module Components

### Carousel

### Catalog

### Codeblock

### Dialog

### Lazyload

### List

### Pagination

### Scrollarea

### Tabgroup

### Todo

{% /section %}
