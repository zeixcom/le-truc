# Phase 0 Spike Report — TSRX as a Server-Side Component Format

**Date:** 2026-08-21
**Status:** complete — technical viability confirmed, **GO** on `@tsrx/core` 0.1.60 (pinned)
**Input:** `ROADMAP.md` §"Where we're heading: server components", the superseded
`PLAN-tsrx-server-components.md` (git history, `f6ef6fe9^`), and direction decisions
from this session: render-args-only data scope, dogfood on docs site + examples,
`@tsrx/core` pinned behind an in-repo emitter interface.
**Output for:** ADR 0023 (the commit decision) — this report's §"Format spec sketch"
is drafted to become the core of that ADR.

## What was tested

Two real components rewritten by hand as single-file `.tsrx` sources (Option C,
authored split), then fed to `@tsrx/core` 0.1.60:

| Spike source | Complexity exercised |
|---|---|
| `sources/basic-counter.tsrx` | minimal: one reactive prop, one binding, static text + `{count}` interpolation, nested `<style>` |
| `sources/module-tabgroup.tsrx` | complex: server `@for` over render args with `; index i`, template-literal attributes, boolean attribute (`hidden`), string-coerced ARIA (`aria-selected`), numeric ternary attribute (`tabindex`), deeply nested CSS (`> [role="tab"]`, `&` blocks) |

Expected outputs (what a Phase 1 emitter must produce) are documented in
`expected/basic-counter.md` and `expected/module-tabgroup.md`. Probe scripts:
`probe.ts` (parse + analyze + export introspection), `probe2.ts` (style
extraction + control-flow walkability).

## Key finding 1 — the grammar moved; the plan's sketch is outdated

The deferred plan sketched the server half as
`export default ({ count = 42 }) => <>…</>`. That is **not valid current
TSRX**. The canonical grammar (tsrx.dev/specification, verified against
`parseModule` 0.1.60) is:

- Components are **ordinary functions** with an optional **statement container**:
  `function Name(params) @{ …statements… output }` — the container ends with
  exactly one output node (element, fragment, or control-flow expression).
- Control flow is **sigil-prefixed**: `@if/@else`, `@for (…; index i; key k) {}`
  with optional `@empty`, `@switch/@case/@default`, `@try/@catch/@pending`.
- **`<style>` bodies are captured as raw CSS and — per the spec — "the host
  owns scoping, class names, and registration."** Tag-scoping is not a hack we
  force on the pipeline; it is an explicitly host-defined decision.
- A grammar-level `server` submodule mechanism exists (`import { load } from server`)
  — noted as future plumbing for the data dimension, unused in this phase.

The validated server-half shape (parses cleanly, both files):

```tsrx
export function BasicCounter({ count = 42 }: { count?: number })
	@{
		<>
			<basic-counter>
				<button type="button">💐 <span>{count}</span></button>
			</basic-counter>

			<style>
				basic-counter { … }
			</style>
		</>
	}
```

## Key finding 2 — every emitter capability question resolved positively

| # | Question | Result | Evidence |
|---|---|---|---|
| 1 | Does the Option C file shape parse? (plain-TS client half + `@{}` server function + `<style>` in one module) | ✅ both sources | `parseModule(source, filename)` → clean `Program` AST |
| 2 | Does the client half pass through intact (incl. `declare global`, module-scope helpers, generics)? | ✅ | `TSModuleDeclaration`, arrow factories, helpers all present in AST |
| 3 | Is target-neutral semantic validation available? | ✅ | `analyzeTsrx(ast, filename)` runs clean on both |
| 4 | Server `@for` with index, template-literal attributes, boolean/ternary attribute expressions | ✅ | `JSXForExpression` nodes (2 found) with structured `left/right/index/body/empty` keys; `TemplateLiteral`, `ConditionalExpression`, `JSXAttribute` nodes all present |
| 5 | Does nested CSS parse? | ✅ | full CSS AST: `Rule`, `ComplexSelector`, `NestingSelector`, `AttributeSelector`, `Combinator` |
| 6 | Can we emit tag-scoped CSS **without class hashing**? | ✅ trivially | default `renderStylesheets` **does hash** (renames root to `module-tabgroup.tsrx-91150b51`, appends `.tsrx-…` to selectors) — but `getStyleElementStylesheet(node).source` retains the **verbatim** CSS text; our emitter concatenates `.source` directly. Bypass confirmed as a one-liner, exactly as the plan anticipated |
| 7 | Is `component` a reserved word (naming collision for the client export)? | ✅ no collision | `const component = 1` parses fine; we use `export const client` regardless |
| 8 | How big is the API surface we depend on? | small & stable-looking | `parseModule`, `analyzeTsrx`, `getStyleElementStylesheet`, `isStyleElement`, `isTemplateForOfNode`/`isTemplateIfNode`/`isTemplateSwitchNode`/`isTemplateTryNode`, `isVoidElement`, `isBooleanAttribute`, `validateNesting`, scope analysis (`createScopes`, `Scope`), diagnostics |

## Key finding 3 — semantic fit is better than the plan feared

The plan's central worry was the render/re-render gap. In practice, for the
Option C scope, **TSRX's semantics on our target are simply TypeScript
semantics**: the server function's `@{}` container is evaluated once at render
time; `@for`/`@if` over render args are plain server control flow. There is no
reactive half to lower yet — the client half is authored, not inferred. The
reactive-root classification problem (server-definitive vs reactive) only
enters at Phase 2 (binding inference), exactly as the plan sequenced.

Notably, both spike components' client halves seed **all** state from the DOM
at connect time (`asInteger()(count.textContent)`, `ariaSelected === 'true'`).
The render function's output and the client's DOM expectations agree by
construction when they live in one file — the drift problem the whole
direction exists to kill.

## Format spec sketch (candidate core of ADR 0023)

**File contract.** One `<tag>.tsrx` file per component, containing:

1. **Client half** — plain TypeScript, passes through the compiler untouched:
   - `export type <Tag>Props` — the exposed-props contract
   - `declare global { interface HTMLElementTagNameMap }` augmentation
   - `export const client = defineComponent(<tag>, factory)` — unchanged
     Le Truc factory code, module-scope helpers allowed
2. **Server half** — `export function <PascalTag>(args) @{ <>…</> }`:
   - Render args are a **distinct type** from client props (server receives
     data and initial-state indices; client exposes reactive props)
   - The output fragment's **first element child must match** the tag derived
     from the file name — compile-time contract check replacing runtime
     `MissingElementError`s for the root
   - Render args only (this direction decision); no data fetching in-file
3. **`<style>` block** inside the fragment, after the root element:
   - Content is today's tag-scoped CSS, verbatim; emitted byte-identical into
     the CSS bundle (`stylesheet.source`), **no hashing**

**Emitter semantics (Phase 1 scope).**

| Construct | Server output | Client output |
|---|---|---|
| Static markup | HTML | — |
| `{expr}` text/attribute over render args | interpolated, escaped (`escapeHtml` semantics) | — |
| `@if`/`@for`/`@switch` over render args | evaluated at render time | — |
| Boolean-valued attribute (`hidden={…}`) | attribute present (valueless) when true, omitted when false | — |
| `<style>` block | extracted verbatim to CSS bundle | — |
| everything in the client half | — | passes through unchanged |

Out of Phase 1 (unchanged from plan sequencing): binding inference, reactive
`@if`/`@for` lowering (`bindVisible`, `reconcile()`), `{html}` raw directives.

## Open format questions (for the ADR, not blockers)

1. **Demo-gallery composition.** Today's `.html` files are galleries of
   instances with `<hr>` and comments. Options: an args manifest per component
   (list of render calls), or page-level templates composing render functions.
2. **Host-attribute escape hatch.** Demo instances set per-instance `id`s; the
   render function needs `{...attrs}` spread support or an explicit `id` arg.
3. **Rich panel content.** `module-tabgroup`'s `<h3>+<p>` panels need either
   trusted `{html content}` or slot-style composition.
4. **Boolean/ARIA stringification.** `aria-selected={String(...)}` is explicit
   today; decide whether an ARIA allowlist auto-stringifies `={boolean}`.
5. **Client-export naming.** `export const client` chosen; `component` is
   available as an identifier, so the original plan's name also works — pick
   one in the ADR.

## Go/no-go

**GO.** `@tsrx/core` 0.1.60 (pinned exact) satisfies every Phase 0 exit
criterion: the file shape parses, the CSS is extractable verbatim, control
flow is walkable, and the API surface we need is small. Conditions attached:

- Pin the exact version (`0.1.60`) in the spike-derived package config; treat
  upgrades as reviewed changes (the API churned between the plan's writing and
  now — e.g. `parseModule(source, filename)` signature).
- Keep the dependence isolated behind the in-repo emitter interface (the
  agreed posture): `@tsrx/core` is touched in one module; everything
  downstream consumes our emitter's output.
- The hash-based `renderStylesheets` default is **not** used; our printer
  reads `stylesheet.source`. If a future core version drops the `source`
  field, that's a pin-breaker to evaluate consciously.

## Recommended next steps

1. **Record ADR 0023** committing to the direction with this report's format
   spec as the core (decision owner: project lead — this report recommends,
   does not decide).
2. **Phase 1** per the deferred plan: in-repo emitter (`server/tsrx/`) on
   `@tsrx/core` producing (a) HTML-string render functions, (b) verbatim
   tag-scoped CSS, (c) pass-through client modules; wired into
   `server/build.ts` as a build effect; migrate 2–3 example components with
   golden-file tests asserting today's trio output byte-for-byte.
3. Fold the five open format questions into the ADR's decision list.
