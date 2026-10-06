# LT-465: Style Scope for Parent-Owned Children

**Run of record:** 2026-10-06, branch `task/LT-465`, Chromium and WebKit (the
Playwright projects). The two browsers gave identical results.

To reproduce:

```sh
bun spike/children-scope/generate.ts
node node_modules/.bin/playwright test --config spike/children-scope/playwright.config.ts
bun spike/children-scope/measure.ts
```

`generate.ts` emits each variant's CSS. It uses the real `emitScopedSheet` for
the status quo and shape (c), and the prototype in
`server/tests/compiler/children-scope.ts` for shapes (a) and (b). The probe
writes `results-<browser>.json` (the matching matrix) and
`wrapper-<browser>.json` (the shape (b) parser check). The text-level fixtures
are in `server/tests/compiler/children-scope.test.ts`.

## Recommendation

**Adopt shape (a), a second scope root at the insertion point.** The marker's
value names the owning tag, so no separate instance guard is needed.

- **Marker.** When a compiled parent composes a child and passes it children,
  the server writes `data-children="<parent-tag>"` on the element of the
  child's template that encloses `{children}`. An instance rendered by the
  page gets no marker, so its rules keep styling page-authored children. That
  keeps ADR 0033 s7 unchanged for page-rendered instances.
- **Why the value replaces the instance guard.** A sheet belongs to a tag, not
  to an instance. Every region that a compose site of tag T created is T's, so
  `[data-children="T"]` is the guard.
- **Child side.** Every component whose template has a `{children}` insertion
  adds the pseudo-boundary `[data-children]:not([data-children="T"])` to its
  boundary set. Its scope then stops at a region another tag owns. The marked
  element itself stays the child's (in the matrix, `code` keeps `C code`).
- **Owner side, native emission.** Add one more block:
  `@scope ([data-children="T"]) to (<boundaries> > *)`. Its rules use the
  lowered lead `:where(T) S`, with the subject anchored by `:where(:scope *)`
  (placed before any pseudo-element). Rules whose subject is the host are
  dropped. The explicit `:scope` matters: without it, the browser adds an
  implicit `:scope ` prefix, which cuts off every ancestor compound outside
  the region. With the implicit prefix, `.wrap .x` fails to match the
  children; with the anchor it matches. Both browsers were probed.
- **Owner side, lowered emission.** There is no second copy. The guard grows a
  re-include clause:
  `:not(:is(B):not(:is([dc="T"] *):not(:is(BR))))`, where `B` is the existing
  boundary list and `BR` is the same list rooted at the region.
- **Specificity.** Every addition sits inside `:where()`, so specificity is
  the same in both emissions. In the matrix, the children (`kid`) take exactly
  the same page-versus-component verdicts as the parent's own internals
  (`own`): a (0,1,1) page rule beats `.x`, and `.wrap .x` beats a (0,1,0)
  page rule.

## Matching Matrix (excerpt; full data in `results-*.json`)

P (`p-par`, class `.on`) composes C (`c-child`, whose template is
`<pre><code>{children}</code></pre><span class="x">`). P passes C three
children: a span (`kid`), a composed `b-btn` (`btnint` is its internal), and
a self-composed A′ (`own2` is its internal; `kid2` is the children A′ passes
to its own C). `pagekid` is a page-rendered C's page-authored child. The
target behaviour is shadow-root semantics:

- P's rules reach `own`, `kid`, `own2` and `kid2`.
- C's rules reach only `childint` and `code`.
- `btnint` gets only B's rules.

| element | status quo | (c) `:global` | (a) native | (a) lowered |
|---|---|---|---|---|
| kid | C only — **P cut off, C leaks in** | P `:global` + C | **P all ✓, no C** | **P all ✓, no C** |
| btnint | B + **C leaks** | B + **P `:global` + C leak** | B only ✓ | B only ✓ |
| childint | C ✓ | **P `:global` leaks** + C | C only ✓ | C only ✓ |
| code | C ✓ | C ✓ | C ✓ | C ✓ |
| own2 (A′) | P `:host .x` + **C leaks** | + `:global` | P ✓ (as a shadow root) | **unstyled** |
| kid2 | C only | `:global` + C | P, but see difference 1 | **unstyled** |
| pagekid | C ✓ (s7) | C ✓ | C ✓ (no marker) | C ✓ |

Shape (b) matches shape (a) cell for cell, because it uses the same CSS.

### Remaining Differences (for the ADR 0033 s7 amendment)

1. **Self-nesting, native.** Region rules resolve their ancestor compounds and
   `:host(<sel>)` against any enclosing T, not only the owning instance. CSS
   cannot say "nearest T". So `kid2` (A′'s children) matched the outer A's
   `.wrap .x` and `:host(.on) .x`, although A′ has neither `.wrap` nor `.on`.
   This only happens when T is nested inside its own region. This is the same
   class of difference as s7's lowered self-nesting.
2. **Self-nesting, lowered.** s7's existing difference grows: A′'s internals
   and A′'s region both go unstyled. The outer A's guard
   (`[dc="p-par"] p-par > *`) excludes them, as `A B > *` already does today.
3. **Proximity (native only).** The region root sits nearer to the subject
   than the child's scope root. On an element that both style, the parent's
   rule therefore beats the child's rule at equal specificity. That matches
   shadow DOM, where the outer context beats `::slotted()`. The lowered
   emission falls back to source order. This matters only once declared roles
   let a child style the children (see "Not covered").

## Served-Byte Cost (`measure.ts`)

Shape (c) adds 0 bytes. Shape (b) adds the same CSS as (a), plus one wrapper
element per insertion. Shape (a):

| component | bytes | gzip |
|---|---|---|
| card-blogpost (native / lowered, child side) | +62 / +948 | +34 / +55 |
| card-callout | +61 / +1694 | +32 / +62 |
| module-cem-list | +64 / +996 | +32 / +55 |
| module-codeblock | +61 / +1580 | +26 / +44 |
| module-dialog | +58 / +1752 | +26 / +50 |
| module-scrollarea | +66 / +1914 | +25 / +60 |
| module-codeblock, owner side, projected* | +1715 / +2349 | +114 / +56 |

\* No corpus component composes a child with children today, because LTC026
blocks it (LT-462). The projection takes module-codeblock with its two
`:global` `pre`/`code` rules moved back into the scoped sheet, which is the
composition LT-462 schedules.

The child side is paid by every component that inserts `{children}`, whether
or not a compiled parent composes it, because the component cannot know. In
lowered emission, a leaf goes from having no guard to having a guard on every
rule. That costs about 1–2 kB raw but only about 60 B gzipped. The native
owner side copies the whole scoped sheet once. The served HTML pays
` data-children="<tag>"` (about 30 B) once per compose-with-children site.

## Rejected Shapes

**(b) A `display: contents` wrapper.** Its CSS is identical to (a), so it buys
nothing there, and it breaks content models (`wrapper-*.json`):

- Inside `<tbody>`, the parser foster-parents the wrapper out of the table.
  The marker is lost, and the region is silently unscoped.
- Inside `<ul>`, `<dl>` and `<select>`, the wrapper survives, but `ul > li`,
  `dl > dt` and `select > option` no longer match.
- It also invalidates the list's HTML content model, and with it the AT
  item-count semantics.
- It breaks structural `first()` paths and `host.firstElementChild`
  addressing; module-scrollarea relies on the latter.

**(c) Status quo plus `:global`.** Ownership then means nothing for styles.
The parent reaches its children only through an unscoped `:global` rule. In
the matrix, that rule leaks into the child's internals (`childint`) and into
every composed element inside the children (`btnint`). Meanwhile the child's
rules still reach the parent's content (`kid` gets `C .x`). This is
module-codeblock today.

## Composition With the LT-462 Verifier Change (Point 1)

The runtime query's exclusion, `:not(<child-tag> *)`, becomes the same
algebra as the lowered guard:

```css
:not(:is(<child> *):not(:is([data-children="T"] *):not(:is([data-children="T"] <child> *))))
```

One helper can generate both. Uniqueness counting must then cover the region
subtree, which is the parent's own children content, and exclude only the
child's template. The marker is present exactly where the verifier needs it:
at a compiled compose site. Server-rendered arm and list templates carry it,
so clones keep it. The existing caveat still holds: the exclusion would also
exclude an element under a same-tag ancestor.

## Not Covered (Decisions for ADR 0048)

- **Forwarded children.** C may pass its own `{children}` straight through as
  D's children. The marker at D's insertion should then name the content's
  owner (P), not C. The server must propagate the owner through a
  pass-through. Content that C wraps first (`<D><div>{children}</div></D>`)
  nests correctly: D's region is owned by C, and the `div`'s region is owned
  by P. This case was reasoned through but not probed.
- **Declared roles (point 2).** Shape (a) stops the child's whole scope at the
  insertion point. A child styling its declared role elements' own boxes
  needs one more emission. A sketch: a role block scoped to the region,
  limited to role-class matches, with `to (<role> > *)`. Difference 3 decides
  who wins on a role box.
- **Marker name.** `data-children` is the sketch. It belongs in
  VOCABULARY_LEDGER next to `data-key`, `data-arms` and `data-list`.
