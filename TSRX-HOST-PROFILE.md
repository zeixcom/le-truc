# The Le Truc TSRX Host Profile

> This file states Le Truc's host-profile decisions for `.tsrx` — the parts of the language core TSRX leaves to the host. See `ARCHITECTURE.md` for the runtime library, `server/tsrx/LE_TRUC_COMPILER.md` for the compiler that implements this profile, and [ADR 0024](adr/0024-adopt-tsrx-as-isomorphic-component-format.md) for the design rationale.

Core TSRX (`@tsrx/core`) defines a shared parser and grammar. It does not define attribute semantics, style scoping, or a class-generation strategy — each host declares its own. TSRX has at least six named host profiles: React, Preact, Solid, Vue, Octane, and Ripple. All six render and hydrate client-side — Octane also does SSR and streaming, but still hydrates in the browser. Le Truc renders once on the server and enhances a light-DOM tree with signals by default, which none of the six do — different enough from every existing profile's model that several "host-defined" gaps in the draft spec only became visible while building this one. This document is also the artifact to hand TSRX core maintainers when raising those gaps upstream: fixing ambiguities now, while host profiles are still few, costs less than fixing them after more hosts exist.

## Styles are unscoped, light DOM

A `.tsrx` component's `<style>` block is emitted **verbatim** — no class hashing, no shadow encapsulation. Selectors are global by default. Every Le Truc component, hand-authored or compiled, scopes its own styles by leading with the custom element's tag name as the outermost selector (see [Styling](docs-src/pages/styling.md#scope-styles-to-custom-element)); `.tsrx` components follow the same convention, just written once and compiled through unchanged.

This is a deliberate divergence from Ripple, the one other profile that scopes via generated class hashes. A tool or agent trained on Ripple's CSS model will misdescribe Le Truc's — state this profile explicitly wherever such tooling might be pointed at a `.tsrx` source.

The compiler does not currently parse or validate selectors — an author who forgets the tag-name prefix gets a working but globally-leaking stylesheet, not a compile error. This is a documentation-only guarantee for now (see "Open questions" below).

## The data account: server props, client markup, boundary-only composition

Where component data lives — ratified by the 2026-08-29 owner review (LT-112/113), binding every Le Truc component, hand-written or compiled:

1. **TSRX server components get all necessary data as props (server args).** When a `.tsrx` component is composed server-side, data reaches it through its props contract only; the generated server render materializes those props into the child's markup. There is no server-side harvesting — the server composes declarations, it does not inspect DOM.
2. **Client Web components can place server-known initial data anywhere in their owned markup, not just in the attribute contract.** A hydrated component owns its light-DOM children: initial state may be encoded as text content, descendant structure, or attributes, and the component harvests it there (`expose` initializers and Parser fallbacks may read `first()`-bound children). A component should not demand as a host attribute what its owned children already carry — avoiding passing template and data twice is one of Le Truc's main advantages over JS frameworks. A host attribute is a legitimate *override* where the contract defines precedence (host attribute wins over the harvested value), not a second copy.
3. **Reaching into sub-components' owned markup is a no-go — only via the declared public interface of the Web Component, or declared config attributes at the boundary.** A parent, server- or client-side, composes through the child's public props and methods, or through attributes the boundary declares (the child's exposed Parser attributes; the compose-site `class`/`id`/`data-*` discriminators). If the child's contract can't express what the composition needs, fix the child: expose a writable prop (`createCell`-backed) when consumers own the value, or a self-derived one (`deriveCell`) when the component computes the message itself from its own state (e.g. a remaining-character count from `maxlength`). Reaching into the child's DOM from the parent (`first()` on the child's template internals, `querySelector` inside a composed child) is an ownership violation even when it works — see the pass write-ownership section below for the signal-level corollary.

Corpus anchors: `basic-button` is the harvest reference (label ← `span.label` with fallback to the button's own text, missing-span tolerated — no attribute duplication); `form-textbox`'s `description` is the boundary-fix reference (a writable prop whose remaining-count display the component derives itself, so parents like `module-coloreditor` compose through the public prop instead of poking the `.description` paragraph).

Migrations preserve the hand-written contract unless a reshape was explicitly decided with architect sign-off (the LT-095 checkpoint pattern); a documented-in-comment deviation is not an acceptable outcome — restore the contract or escalate.

The `.tsrx` compiler cannot yet express the pure light-DOM-enhancer contract (a template-less component harvesting page-authored children) — see NOTES.md; such components stay hand-written until that capability exists.

## `truc:pass` is host-owned, not a TSRX deviation

Core TSRX defines no attribute semantics at all — every attribute's meaning is host-defined. Le Truc uses the namespaced form `truc:pass={{ ... }}` (`JSXNamespacedName` is grammar-native) for client-side signal interop with a custom-element target. The namespace prefix avoids collision with a user-defined prop literally named `pass`, and matches the ecosystem convention of namespacing host-owned attributes. It lowers to a `pass(target, { ... })` call (ADR [0011](adr/0011-throw-on-pass-binding-failure.md), ADR [0012](adr/0012-deprecate-unrestricted-write-short-forms-in-pass.md)).

### Pass write-ownership

A pass replaces the target's Slot for that prop — the child's own writes to the prop route through whatever the parent passed. A **getter-only** thunk (`{ value: () => host.value }`) therefore makes every child-side write to that prop throw `Signal is read-only`: the child's own event handlers, its exposed methods, even the library's built-in `formResetCallback` baseline restore. Getter-only passes are only safe when the child provably never writes the prop itself.

One more sharp edge (found in LT-113, verified live): a getter-only pass into a prop whose exposed `createCell` feeds an internal `deriveCell` display **disconnects the derivation** — the pass swaps the Slot's backing while the derivation keeps reading the internal cell, so the display freezes on its seed. Direct writes and `watch()` + `bindProperty()` pushes both flow correctly (they write through the Slot into the cell). Until/unless the compiler routes such derivations through the exposed Slot, the commit-on-change shape below is not just preferred for form children — it is required whenever a parent-derived value feeds a child's derived display.

When a composition needs a child-writable prop whose value the parent derives (a spinbutton that steps its own value inside a color graph, a textbox the parent pre-fills but the child edits), use `watch()` + `bindProperty()` + commit-on-change instead: the parent pushes the derived display value down with `watch(() => derived, bindProperty(child, 'value'))`, and commits the child's committed result back up from a `change`-style event, reading `child.value`. Ratified in LT-091's review after the form-colorgraph spec caught the throw (`examples/form/colorgraph/form-colorgraph.tsrx` is the reference composition; `examples/form/inplace-edit/form-inplace-edit.tsrx` applies the same pattern to a composed textbox). A mediated `{ get, set }` descriptor is the middle ground — the parent intercepts writes — but note it re-enters on the library's own internal writes (form reset re-commits a stale baseline through the setter), which is why the commit-on-change shape is preferred for form-associated children.

## Element references are `first()`-based, never `ref={}`

Le Truc has no `ref={}` binding. An author declares `const el = first(selector, required?)`, resolved structurally against the template on the server and via the DOM on the client. Selector-literal types infer precise, non-nullable element types through `HTMLElementTagNameMap` (e.g. `first('input, textarea', 'required')` → `HTMLInputElement | HTMLTextAreaElement`).

## Lazy destructuring does not apply

Core TSRX's `&{` / `&[` lazy-pattern introducers (`LazyObjectBindingPattern`, `LazyArrayBindingPattern`) have no role in this profile. Le Truc's server composition requires eager snapshot evaluation to generate markup — a lazily-destructured binding has nothing to evaluate against at render time. The compiler rejects `&{}`/`&[}` outright (diagnostics TSRX018/TSRX020; see `server/tsrx/LE_TRUC_COMPILER.md`). This is enforced, not just documented — the one item in this profile that graduated from a doc note to a compiler diagnostic once real authoring surfaced the ambiguity.

## Statements before output are legal

`TemplateBlock : { StatementListItemList TemplateOutput }` is grammar-native and Le Truc uses it as-is: a `@if` / `@for` / `@switch` / `@try` body may contain statements before its single output node. This is already true in the compiler and needed no change — it is listed here because it is easy to assume otherwise coming from a host that forbids it.

## Imports: real exports explicit, FactoryContext vocabulary ambient

A `.tsrx` source imports the real `@zeix/le-truc` exports its setup code references — signal constructors (`createCell`, `deriveCell`, …), parsers (`asString`, `asNumber`, …), `defineMethod`, form utilities — with an ordinary `import { ... } from '@zeix/le-truc'` naming only what is used. These are true module exports, so an authored source is valid TypeScript by construction.

The FactoryContext vocabulary an author actually writes — `expose`, `first`, `all`, `host`, `internals`, `requestContext`, `provideContexts` — stays ambient, declared by `server/tsrx/globals.d.ts`. The factory parameter these names arrive on is compiler-generated: there is no authored binding site an import or destructure could honestly occupy, and the names are not package exports, so an import line naming one is a false declaration.

The effect machinery — `watch`, `on`, `pass`, `each`, every `bind*` — is never authored at all. Template syntax lowers to it in generated code: a function-valued attribute becomes `watch()` plus a `bind*` helper, `on*` attributes become `on()`, `truc:pass={{ ... }}` becomes `pass()`, `@for` becomes `each()`. The compiler errors when a real export is used without its import (TSRX036) and when a FactoryContext name appears inside an authored import (TSRX037), both with fix-its (ADR [0024](adr/0024-adopt-tsrx-as-isomorphic-component-format.md), sub-design 16).

This policy was decided, implemented, and reversed within one day (2026-08-27). The first amendment required imports for the FactoryContext helpers themselves, on the theory that explicit imports would fix unhighlighted ambient identifiers in TSRX editors. They do not: Zed's TSRX language service cannot resolve even explicit imports — the editor experience is broken more fundamentally than import style can address, and the fix belongs upstream, out of scope for this library. Explicit imports survive for the one benefit that holds regardless of editors: authored sources that are honest TypeScript the moment a working language service arrives.

## Open questions for upstream

- The draft TSRX spec (dated June 2026) under-specifies several host-owned areas in practice — attribute semantics, style scoping, class generation — because few host profiles existed to specify them against. Ripple and Le Truc diverge sharply enough on some of these (style scoping in particular) that the spec text alone doesn't settle a new host's design.
- Whether "host-owned" extends to selector-scoping *enforcement* (should a host be allowed to lint or reject non-conforming CSS, or only to declare its own default) is not addressed at all.
