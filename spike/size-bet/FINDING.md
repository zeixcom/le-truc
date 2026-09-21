# LT-266 — The Size Bet, Measured

**Run of record:** 2026-09-21, at the tree containing commit `a8a3bdee` (v3).
Reproduce with `bun scripts/measure-size-bet.ts` — the script rebuilds every
bundle from source and prints the full table; the numbers below are its
output. Nothing here is hand-copied except the rounding to kB.

## The question

The project's thesis (REQUIREMENTS §1, ADR 0032): a JSON payload,
JS-ified templates and a framework runtime are replaceable by HTML plus a
small runtime that harvests initial state from the DOM and applies
fine-grained effects. Everything a framework does is *representable*, so the
ceiling is not expressive but **economic** — and until now it had never been
measured. This is that measurement, for one real application, both ways.

## The application and the split

`module-todo` — the flagship composite: add, remove, complete, in-place
edit, filter, clear-completed, drag-and-drop AND keyboard reordering, live
region announcements. It was chosen because it is the example with a real
JSON payload cost in the React case: a hydrated todo list carries initial
state, and the two systems speak different channels for it.

The **component split is identical on both sides**:

```
module-todo (composite)
├── form-textbox        (add-item input, clear affordance, clear() method)
├── basic-button  × 3   (submit / remove / clear-completed)
├── basic-pluralize     (remaining count, CLDR categories)
├── form-checkbox       (complete toggle)
├── form-inplace-edit   (label ⇄ edit textbox)
└── form-radiogroup     (all / active / completed filter)
```

- **Le Truc side (real, in-repo):** `examples/module/todo/module-todo.ts` —
  the hand-authored component a page ships today — plus the six composed
  children as their compiled corpus clients (`server/generated/components/*.client.ts`),
  the exact mixed import shape of `examples/main.ts`.
- **React side (`spike/size-bet/react/`):** the same split written as
  idiomatic React 19 function components, same DOM shape (down to the
  `basic-button`/`form-textbox` element shells), same behaviors, hydrated
  via `hydrateRoot` from a JSON payload script. React 19.3.0, production
  build.

## The scenario

The component instantiated with **5 seeded items** (mixed completion,
`spike/size-bet/react/seed.ts`). The state channel is the bet:

- **Le Truc:** the items ride as authored page markup; the component
  harvests at connect. No state crosses the server→client boundary
  (ADR 0003) — the JSON payload line is **0 by design**.
- **React:** the same rendered DOM **plus** `JSON.stringify(initial)` in a
  `<script type="application/json">` — 543 B raw / 231 B gzip for 5 items,
  shipped on every visit, scaling with the list.

## The numbers (over the wire)

| artifact                                        | gzip            | brotli          |
| ----------------------------------------------- | --------------- | --------------- |
| **Le Truc** runtime floor (minimal component)   | 8.72 kB         | 7.79 kB         |
| **Le Truc** payload (composite + 6 children)    | 8.54 kB         | 7.69 kB         |
| **Le Truc** HTML (seeded page markup)           | 1.35 kB         | 1.05 kB         |
| **Le Truc** JSON state payload                  | —               | —               |
| **Le Truc TOTAL**                               | **18.61 kB**    | **16.53 kB**    |
| **React** runtime floor (`react`+`react-dom/client`) | 64.38 kB   | 55.50 kB        |
| **React** payload (composite + 6 children)      | 3.07 kB         | 2.79 kB         |
| **React** JSON state payload (5 items)          | 0.23 kB         | 0.18 kB         |
| **React** HTML (SSR + payload script)           | 0.94 kB         | 0.74 kB         |
| **React TOTAL**                                 | **68.62 kB**    | **59.21 kB**    |

**The bet holds: 3.7× less over the wire (gzip), 3.6× less (brotli).**

Per-component rows, page bundles and raw bytes: run the script; it prints
the full table. Note the per-component rows each include their framework
slice and deliberately do not sum.

## Reading the numbers honestly

1. **The win is the runtime, not the payload.** Le Truc's runtime floor is
   7.4× smaller than React's (8.72 vs 64.38 kB gzip) — that is where the
   whole margin comes from. The PAYLOAD line goes the other way: React's
   component code is ~2.8× smaller than Le Truc's (3.07 vs 8.54 kB gzip).
   React's compiled templates are very compact; Le Truc's harvest-and-bind
   machinery plus the hand-authored module-todo logic cost more per
   component. For any page carrying a realistic number of components the
   runtime dominates, which is why the total favours Le Truc — but a
   connector-payload-comparison claim must quote BOTH lines, because the
   payload gap narrows as components are added and never flips in Le
   Truc's favour for this split.
2. **The HTML is nearly a wash.** Le Truc's seeded HTML is ~0.4 kB gzip
   HEAVIER than React's SSR: the extracted item `<template>` and the
   authored child state ride in the markup, while React renders items
   directly and pays state separately as JSON. Per item, React's JSON
   costs ~46 B gzip (5 items → 231 B); Le Truc's per-item template lines
   are fixed overhead. A 100-item seed adds ~4.6 kB gzip to React's page
   and nothing to Le Truc's.
3. **The JSON payload is real but small at demo scale.** The user-facing
   claim survives: React ships its state TWICE (DOM + JSON); Le Truc ships
   it once. At 5 items the JSON is 231 B gzip; the structural point is the
   scaling, not the constant.
4. **`module-todo` ships hand-authored.** Its 370-line enhancer is the
   single largest payload line on the Le Truc side (14.52 kB gzip
   standalone). The TSX conversion attempt below did not land — so the
   measured Le Truc payload is the honest, shippable-today artifact, not a
   compiler-flattered one.

## The TSX conversion attempt (ADR 0032 surface)

The task asked for module-todo converted to the `.tsx` authored surface.
The conversion was drafted in full and driven through the compiler until it
hit hard walls. It did **not** land; `module-todo.ts` remains the authored
source (one tag, one source — no dual declaration). The walls, each pinned
to its diagnostic or code site:

1. **Sanctioned setup subset (LTC005, `server/compiler/setup-extraction.ts`).**
   Authored setup admits single-`const` declarations, `expose()`, and
   client-only side effects over client-known names. The twin's mutable
   drag bookkeeping (8 `let`s), hoisted `function` helpers, and any
   statement referencing module-level state (`idCounter`) are refused.
   Mechanical rewrites exist (a `const` state holder, `const` arrows) and
   were applied — but they only matter because wall 2 is passable.
2. **`watch()`/`pass()` inside deferred callbacks (LTC045).** The twin's
   `each(all('form-checkbox'), el => pass(el, …))` per-item wiring is a
   static error — the ambient collector is gone by callback time. The
   sanctioned replacement for per-item wiring is `truc:pass` on loop-body
   elements — which leads to wall 3.
3. **Reactive-list loops lower to a text fill + events, nothing else**
   (`ReconcilePlan`, `server/compiler/analysis/plan.ts:185`;
   `emitReconcileBlock`, `server/compiler/emit-client.ts:259`). The
   generated bindItem is `watch(item, bindText(…))` plus per-item event
   listeners. There is no per-item `truc:pass` channel, no per-item
   reactive attribute (the reorder button's `disabled` watch), no per-item
   id/`for` wiring, and the fill must be the bare `{item}` — store-backed
   items (`createStore`, which the checkbox/inplace-edit passes depend on)
   would render as `[object Object]`. The `.tsrx` surface's `key k` clause
   adds a key binding (`keyName` is hard-coded `null` on `.tsx`,
   `lower-tsx.ts:782`) but nothing else; the same walls stand there.
4. **Composed children inside reactive-list bodies** have no per-item arg
   channel at all (ADR 0024 sub-design 5), so `<FormInplaceEdit …/>` in the
   loop is equally out.

**Conclusion:** module-todo is not expressible on the authored surface —
not because of style, but because the reactive-list lowering covers the
module-list shape (text items, a remove button) and nothing richer. This
is exactly the kind of gap the wave-4 migration gate (LT-178/179) exists to
surface before example migrations open; it is filed for the Architect in
`NOTES.md` (next free ID LT-280 at time of writing).

## Method notes (for reproducibility and for attacking the numbers)

- Bundles: `Bun.build`, `target: browser`, `minify: true`,
  `DEV_MODE="false"`, `NODE_ENV="production"` — the last one matters: a
  browser-target build otherwise defaults to development and ships React's
  dev bundle, which silently inflates the React side by ~2×.
- "Runtime floor": the smallest entry that still pulls the framework in —
  `test/fixtures/minimal-entry.ts` for Le Truc (the same fixture the
  regression-bundle test guards at a 9 kB gzip ceiling; measured 8.72),
  `hydrateRoot` on an empty root for React (64.38 kB gzip: React 19.3 +
  react-dom client, production).
- "Payload": page bundle minus runtime floor — derived, not measured
  (compression does not decompose additively); treated as indicative.
- HTML: Le Truc = the authored fixture with the 5 items filled from its own
  `<template>` (the data-account way to instantiate with initial state);
  React = `renderToStaticMarkup` + the payload script. Stylesheets are not
  measured — both sides' CSS is framework-neutral for this comparison.
- Compression: gzip level 9, brotli quality 11.
