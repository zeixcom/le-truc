---
title: 'Async State'
emoji: '⏳'
description: 'Tasks, loading and error states'
---

{% hero %}
# ⏳ Async State

**Model async work as a `Task`.** Loading, error, stale, and success stop being ad-hoc booleans and become first-class reactive values. `match()` routes each state to the DOM update that belongs to it.
{% /hero %}

{% section %}
## Model Async Work as a Task

When a component needs to load data — fetch a fragment, import a module, run any async work — the naive approach is a loading flag, an error variable, and a `watch` that does the fetching. Three pieces of state, none of them reactive, all of them easy to get wrong.

Model the work itself as a [`Task`](./api.html#functions/createTask) instead. A `Task` is an async derivation. It auto-cancels in-flight work when its dependencies change. It exposes four states through `match()`: `ok`, `nil`, `stale`, and `err`.

Routing precedence is `nil` > `err` > `stale` > `ok`:

- **`nil`** fires on the first run, before any value has resolved
- **`err`** fires when the task rejects
- **`stale`** fires when the task has a retained value *and* is recomputing after a dependency change — use it to keep the old content visible while refreshing
- **`ok`** fires with the resolved value

The `module-lazyload` component shows the full pattern. It `fetch`es an HTML fragment and injects it into a content element. It drives separate loading, error, and content views from a single `Task`:

```js#module-lazyload.js
defineComponent('module-lazyload', ({ expose, first, host, watch }) => {
  const callout = first('card-callout', 'Needed to display loading state and error messages.')
  const loading = first('.loading', 'Needed to display loading state.')
  const errorEl = first('.error', 'Needed to display error messages.')
  const contentEl = first('.content', 'Needed to display content.')

  const content = createTask(async (_prev, abort) => {
    const url = host.src
    if (!url) throw new Error('No URL provided')
    const response = await fetch(url, { signal: abort })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.text()
  })

  expose({ src: asString() })

  watch(content, {
    ok: html => {
      loading.hidden = true
      contentEl.hidden = false
      contentEl.innerHTML = html
    },
    nil: () => {
      loading.hidden = false
      contentEl.hidden = true
    },
    stale: () => {
      contentEl.style.setProperty('opacity', 'var(--opacity-dimmed)')
      return () => contentEl.style.removeProperty('opacity') // reset on next dispatch
    },
    err: error => {
      loading.hidden = true
      errorEl.hidden = false
      errorEl.textContent = error.message
      contentEl.hidden = true
      return () => { errorEl.hidden = true; errorEl.textContent = '' }
    },
  })
})
```

The HTML provides all three regions up front. The `watch` handler toggles their visibility as the `Task` moves through its states:

```html
<module-lazyload src="./fragments/details.html">
  <card-callout>
    <p class="loading" role="status">Loading…</p>
    <p class="error" role="alert" aria-live="assertive" hidden></p>
  </card-callout>
  <div class="content" hidden></div>
</module-lazyload>
```

{% callout .tip title="Return a cleanup from stale and err handlers" %}
`stale` and `err` receive no arguments. They may return a cleanup function that runs synchronously before the next dispatch. Use it to reset DOM state you changed, such as removing a dimming class or clearing the error text. This way the next `ok` or `stale` run starts clean.
{% /callout %}

{% callout .caution title="The Task owns the async work" %}
Do not `fetch` inside a plain `watch` callback. A `Task` receives an `AbortSignal`. It auto-cancels when its dependencies change, so switching `src` aborts the in-flight request. Its pending and error states become first-class reactive values that compose through `match()`.
{% /callout %}

The playground below is live. The first fetch starts on its own — watch `nil` light up while nothing has resolved, then give way to `ok`. Refetch and the old release stays visible under `stale` until the new one lands. Tick the failure box and the next refetch ends in `err`. Every log line is a real state transition of one `Task`.

{% demo %}
```html
<docs-task-states>
  <div class="states" data-state="" role="status">
    <span class="state nil">nil</span>
    <span class="state err">err</span>
    <span class="state stale">stale</span>
    <span class="state ok">ok</span>
  </div>
  <output class="value">no value resolved yet</output>
  <p class="error" role="alert" hidden></p>
  <div class="controls">
    <button class="fetch" type="button">Fetch</button>
    <label class="fail-toggle">
      <input class="fail" type="checkbox" /> Let the next fetch fail
    </label>
  </div>
  <ol class="log"></ol>
</docs-task-states>
```
{% /demo %}

{% /section %}

{% section %}
## Fetch Data into a List

A `Task` fetches one value. When the data is a keyed list, derive a `DerivedList` from the fetch and hand it to [`reconcile()`](lists.html). `deriveList` accepts the async function directly. It manages cancellation and refresh internally:

```js#module-users.js
defineComponent('module-users', ({ expose, first, host, watch }) => {
  const container = first('[data-container]', 'Add a container element for users.')
  const template = first('template', 'Add a template element for users.')

  expose({ src: asString() })

  const users = deriveList(
    async (_prev, abort) => {
      const response = await fetch(host.src, { signal: abort })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json()
    },
    { initial: [], keyConfig: user => user.id },
  )

  reconcile(container, template, users, (element, item) => { /* fill content */ })
  watch(() => isPending(users), pending => { container.ariaBusy = String(pending) })
})
```

`{ initial: [] }` seeds the list before the first response. `{ keyConfig }` gives each fetched item a stable key. When `src` changes, the in-flight request aborts and `reconcile()` re-syncs the container to the new keys. `isPending()` works on any signal with an async origin, the derived list included.

To adapt a signal you already hold — a `Task` created elsewhere — pass a thunk that reads it: `deriveList(() => task.get(), { keyConfig: item => item.id })`.

{% /section %}
