# ADR 0006: Lazy MutationObserver for all() Collections

## Status

✅ Accepted

## Context

Need to watch for DOM changes to matched elements from `all(selector)`, but avoid overhead for collections that are never actually read in effects. A always-on observer would add unnecessary performance cost, while polling would be even less efficient.

## Decision

`MutationObserver` for `all()` collections activates lazily on first read via the `watched` option on `createMemo`, rather than always-on or polling. The observer auto-disconnects when unwatched.

`all(selector)` returns a `Memo<E[]>` created by `createElementsMemo()`. The `MutationObserver` is set up lazily (via the `watched` option) and watches for `childList`, `subtree`, and relevant attribute changes.

## Alternatives Considered

- **Always-on observer** — Adds overhead even for collections never read in effects
- **Polling** — Inefficient; misses mutations between polls; adds CPU overhead

## Consequences

**Good:**
- Avoids overhead for collections not read in effects
- Auto-disconnects when unwatched (no memory leaks)
- Smart attribute watching: `extractAttributes(selector)` parses the CSS selector to find attribute names implied by `.class`, `#id`, and `[attr]` patterns
- Custom `equals` function `(a, b) => a.length === b.length && a.every((el, i) => el === b[i])` compares arrays by element identity, preventing spurious invalidations
- Mutation filtering via `couldMatch` helper prevents invalidations from mutations *inside* matched elements

**Bad:**
- Slight delay on first read (observer setup is deferred)
- More complex implementation than always-on observer

## Related

- Requirements: [M7](REQUIREMENTS.md#m7-dynamic-element-collections-via-all)
- Architecture: [The UI Query System](ARCHITECTURE.md#the-ui-query-system), [`all(selector, required?)`](ARCHITECTURE.md#allselector-required)
- Supersedes: None
