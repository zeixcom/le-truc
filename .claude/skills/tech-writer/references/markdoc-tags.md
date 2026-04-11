<overview>
Markdoc authoring reference for `docs-src/pages/`. Pages use Markdoc — a superset of
Markdown with typed custom tags. Read this before editing any page in `docs-src/pages/`.
</overview>

## Frontmatter

Every page starts with YAML frontmatter:

```yaml
---
title: 'Components'          # required — used in <title> and navigation
emoji: '🏗️'                  # required — displayed in the nav and hero
description: 'Anatomy, lifecycle, signals, effects'  # required — used in meta tags
layout: 'page'               # optional — defaults to 'page'; also: 'blog', 'overview', 'example', 'api'
---
```

The `layout` field selects the HTML template from `docs-src/layouts/`. Most narrative pages use the default (`page`). Only set it explicitly when using a non-default layout.

## Available tags

### `{% hero %}` / `{% /hero %}`

Full-width hero block at the top of the page. Contains the page heading and a brief tagline.

```markdoc
{% hero %}
# 🏗️ Components

**One sentence tagline.** Optional second sentence expanding on the first.
{% /hero %}
```

The heading inside `{% hero %}` is the H1 for the page. Only use one per page.

### `{% section %}` / `{% /section %}`

Groups content into a visually distinct section. Optionally accepts a CSS class:

```markdoc
{% section %}
## Section Heading
Content here.
{% /section %}

{% section .breakout %}
## Full-Width Section
Content here — extends beyond the normal content width.
{% /section %}
```

All content below the hero should be wrapped in `{% section %}` blocks.

### `{% callout %}` / `{% /callout %}`

Highlighted aside for tips, warnings, or important constraints.

```markdoc
{% callout .tip title="Pass() works with Le Truc components only" %}
Body text explaining the constraint in one or two sentences.
{% /callout %}
```

- `.tip` — green/blue; for best practices and helpful guidance
- `title` attribute — displayed as the callout heading; omit for an untitled callout

Use sparingly: one per major section at most. Do not use for content that belongs in the main prose.

### `{% demo %}` / `{% /demo %}`

Renders an interactive demo with the HTML markup inside and optional source links below.

```markdoc
{% demo %}
```html
<my-component>
  <button type="button">Click me</button>
</my-component>
```

{% sources title="MyComponent source code" src="./sources/my-component.html" /%}
{% /demo %}
```

- The fenced code block inside `{% demo %}` is both displayed as source and rendered live.
- `{% sources /%}` is a self-closing tag that adds a link to the component's source file.
- `src` points to a path under `docs-src/` (typically `./sources/component-name.html`).
- Multiple `{% sources /%}` tags can appear inside one `{% demo %}` block.

### `{% sources title="…" src="…" /%}`

Self-closing. Adds a labeled link to a source file. Used inside `{% demo %}` blocks.

```markdoc
{% sources title="BasicCounter source code" src="./sources/basic-counter.html" /%}
```

### `{% callout %}` title attribute is optional

```markdoc
{% callout .tip %}
Short tip with no explicit title.
{% /callout %}
```

### `{% tabgroup %}` / `{% /tabgroup %}`

Renders content as tabs. Headings inside the block become tab labels; `---` separates tab content:

```markdoc
{% tabgroup %}
#### NPM

```sh
npm install @zeix/le-truc
```

---

#### Bun

```sh
bun add @zeix/le-truc
```
{% /tabgroup %}
```

### `{% listnav title="…" %}` / `{% /listnav %}`

Renders a navigable list, used for the examples and API index pages. The list is authored as nested Markdown:

```markdoc
{% listnav title="Select a Component" %}
- Basic
  - [Button](./examples/basic-button.html)
  - [Counter](./examples/basic-counter.html) selected
{% /listnav %}
```

The word `selected` after a link marks the currently active item. Remove it when not needed (it is typically set at runtime and should not be hardcoded in authored content).

### `{% carousel %}` / `{% /carousel %}` and `{% slide %}` / `{% /slide %}`

Renders a slideshow. Each `{% slide %}` becomes one slide:

```markdoc
{% carousel %}
{% slide title="Slide Title" class="purple" %}
Slide content here.
{% /slide %}

{% slide title="Another Slide" class="pink" %}
More content.
{% /slide %}
{% /carousel %}
```

Slide `class` values set the color theme. Available: `purple`, `pink`, `orange`, `green`, `blue`.

## Code blocks with filenames

Add a filename annotation to a fenced code block by appending `#filename` after the language:

````
```js#module-catalog.ts
// code here
```
````

This renders the filename as a label above the block. Use when the file context helps the reader understand where the code lives.

## Standard Markdown in pages

All standard Markdown works inside tag blocks and between them:

- ATX headings (`## H2`, `### H3`) — use H2 for section headings, H3 for subsections
- Fenced code blocks with language hint
- Bold (`**text**`) and italic (`*text*`)
- Unordered lists, ordered lists
- Inline links `[text](url)`

Do not use bare `---` horizontal rules for section dividers — use `{% section %}` blocks instead.

## What is not available

- Markdoc table syntax (`{% table %}`) is available in the config but not commonly used in pages — use standard Markdown pipe tables instead
- Custom HTML beyond what the Markdoc tags produce — avoid raw `<div>` or `<span>` in page content
