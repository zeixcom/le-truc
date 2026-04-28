# Server Strategies

Cause & Effect is a client-side library. It has no server-side rendering capability of its own. This document describes how to structure the server layer when building applications where Web Components use Cause & Effect for client-side reactivity.

The fundamental contract is simple: **the server produces HTML; the signal graph takes over from there.** Web Components upgrade in place via `connectedCallback`, read their initial state from attributes and slots, and drive all subsequent DOM updates through effects. The server is not involved in updates — only in the initial render and in responding to fetch calls.

## Passing Initial State to Components

However the server produces HTML, it must communicate initial state to each component. Two conventions cover the common cases.

**Attributes** are the standard mechanism. Primitive values (strings, numbers, booleans) serialize naturally:

```html
<user-profile name="Alice" role="admin" verified></user-profile>
```

In `connectedCallback`, the component reads these with `getAttribute()` and initializes signals:

```ts
connectedCallback() {
  const name = createState(this.getAttribute('name') ?? '')
  const role = createState(this.getAttribute('role') ?? 'viewer')
}
```

**JSON attributes** work for structured data that doesn't map to a flat attribute set:

```html
<data-table columns='["name","role","joined"]' rows='[...]'></data-table>
```

Keep JSON attributes small. For larger datasets, an inline `<script type="application/json">` inside the component's light DOM is preferable — it avoids attribute-length limits and is easier to generate server-side without double-escaping.

**Slots** carry rich initial content as HTML, which the server can render with full markup:

```html
<docs-article>
  <h1 slot="title">Getting Started</h1>
  <div slot="body"><!-- server-rendered HTML --></div>
</docs-article>
```

**Declarative Shadow DOM** lets the server render a component's shadow root as static HTML. The browser parses and attaches it before any JavaScript runs — the component upgrades without a flash of unstyled content:

```html
<user-card>
  <template shadowrootmode="open">
    <link rel="stylesheet" href="/components/user-card.css">
    <slot name="avatar"></slot>
    <slot name="name"></slot>
  </template>
  <img slot="avatar" src="/avatars/alice.jpg" alt="">
  <span slot="name">Alice</span>
</user-card>
```

Use Declarative Shadow DOM when the component's internal structure must be present before JavaScript loads — for layout stability, accessibility, or above-the-fold performance.

## Strategies

### Static Site Generation

Pre-render all pages to HTML files at build time. No server is needed at runtime — files are served directly from a CDN or file server.

**When to use.** Documentation, blogs, marketing sites, and any content that changes on a known schedule rather than per-request. The build pipeline runs whenever content changes; the output is a directory of plain HTML files.

**Shape of a build pipeline:**

1. Collect source files (Markdown, data files, templates)
2. Process each source into HTML (parse, transform, apply layout)
3. Write output files to `dist/`

The templating layer can be anything that produces HTML strings from TypeScript: tagged template literals, a lightweight template engine, or a purpose-built static site tool. Web Components in the output HTML are static tags with attributes carrying initial state — they upgrade on the client when the page loads.

**Watch mode** for development runs the same pipeline incrementally: track which output files depend on which inputs, rebuild only affected pages when a source changes, and serve the output with a simple dev server and live reload.

### Server-Side Rendering

Render HTML per request on a running server. The template runs with request-specific data — the current user, query parameters, database results — and streams or returns the complete HTML response.

**When to use.** Personalized pages, authenticated content, search results, any page whose content depends on who is asking or what they queried.

**Any HTTP server works.** Bun, Node with Hono or Fastify, Deno, a serverless function — the server is just a function from request to HTML response. The templating layer is the same as for static generation; the difference is that data is fetched at request time rather than build time.

Streaming HTML (`Transfer-Encoding: chunked`) lets the browser begin parsing and upgrading above-the-fold components before the full response arrives. For pages where some data is slow to fetch, stream the shell immediately and flush the slow sections as they resolve.

### Fragment-Based Navigation

Instead of full page reloads, a router component intercepts link clicks, fetches only the changed region of the page from the server as an HTML fragment, and replaces the outlet's content. This is the server-driven equivalent of client-side routing.

**The server** handles fragment requests identically to full-page requests, except it returns only the inner HTML of the outlet — no `<html>`, `<head>`, or persistent layout. A request header or query parameter signals to the server that a fragment is wanted:

```
GET /docs/guide HTTP/1.1
X-Fragment: true
```

**The router component** on the client manages the URL and the outlet:

```
navigation → intercept click → fetch fragment → replace outlet → update URL
```

Cause & Effect signals in persistent components (navigation, header, sidebar) remain active across navigations because those components are never removed from the DOM. Only the outlet content is replaced.

**Progressive enhancement.** Fragment navigation is an enhancement over full page reloads — the same URLs work with or without JavaScript. If the router's fetch fails or JavaScript hasn't loaded yet, following a link produces a normal full-page load.

The [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API) can wrap the outlet swap to animate between pages without a separate client-side routing library.

### Optimistic Mutations

User actions that modify server state — form submissions, item edits, deletions — follow a consistent pattern: update client state immediately, fire a fetch in the background, and let the server response confirm or correct.

```
user action
  → update signals optimistically (State.set / Store.update)
  → UI reflects change immediately
  → fetch to server
  → server responds with authoritative data
  → Store.update(serverResponse)   // usually a no-op
  → on error: Store.update(previousState) or show error signal
```

Because `Store.update()` diffs the new object against current signal values and propagates only actual changes, a confirming server response that matches the optimistic update causes no re-renders. The server wins on any divergence — stale data, validation errors, concurrent edits — and the UI converges to the authoritative state automatically.

This pattern requires no dedicated mutation library. A `Task` that fires the fetch and feeds the result back into the relevant `Store` or `State` is sufficient.

## Choosing a Templating Approach

The server's templating layer is independent of Cause & Effect. Any approach that produces correct HTML with the right attributes and slots works. The main options:

**Tagged template literals** are the lightest option — pure TypeScript, no build step, streaming-friendly. The library must auto-escape interpolations to prevent XSS; a `raw()` escape hatch handles trusted HTML (e.g. processed Markdown). This is the approach of the companion `@zeix/le-truc-server` package.

**Lightweight JSX without React** — configure the TypeScript compiler with a custom `jsxImportSource` that renders to HTML strings rather than a virtual DOM. You get JSX syntax and TypeScript attribute type-checking without a React dependency. Libraries like `@kitajs/html` implement this pattern.

**Existing template engines** (Nunjucks, Handlebars, Pug, Jinja via a Python backend) work for teams that already use them or prefer a strict separation between logic and markup. They lose TypeScript type-checking on template data but are familiar and mature.

**Astro** is a full framework built around the "HTML by default, JavaScript only where needed" model. Its `.astro` components are server-only and stream HTML; Web Components drop in as first-class citizens for client-side interactivity. Astro handles routing, builds, and asset pipelines, making it a viable full-stack choice for projects that want these concerns handled without building them from scratch.

The right choice depends on project scale, team familiarity, and how much of the server layer you want to own. Tagged template literals and lightweight JSX suit teams that want full control with minimal dependencies; Astro suits teams that prefer a complete, opinionated solution.
