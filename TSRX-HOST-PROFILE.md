# The Le Truc TSRX Host Profile

> This file states Le Truc's host-profile decisions for `.tsrx` — the parts of the language core TSRX leaves to the host. See `ARCHITECTURE.md` for the runtime library, `server/tsrx/LE_TRUC_COMPILER.md` for the compiler that implements this profile, and [ADR 0024](adr/0024-adopt-tsrx-as-isomorphic-component-format.md) for the design rationale.

Core TSRX (`@tsrx/core`) defines a shared parser and grammar. It does not define attribute semantics, style scoping, or a class-generation strategy — each host declares its own. TSRX has at least six named host profiles: React, Preact, Solid, Vue, Octane, and Ripple. All six render and hydrate client-side — Octane also does SSR and streaming, but still hydrates in the browser. Le Truc renders once on the server and enhances a light-DOM tree with signals by default, which none of the six do — different enough from every existing profile's model that several "host-defined" gaps in the draft spec only became visible while building this one. This document is also the artifact to hand TSRX core maintainers when raising those gaps upstream: fixing ambiguities now, while host profiles are still few, costs less than fixing them after more hosts exist.

## Styles are unscoped, light DOM

A `.tsrx` component's `<style>` block is emitted **verbatim** — no class hashing, no shadow encapsulation. Selectors are global by default. Every Le Truc component, hand-authored or compiled, scopes its own styles by leading with the custom element's tag name as the outermost selector (see [Styling](docs-src/pages/styling.md#scope-styles-to-custom-element)); `.tsrx` components follow the same convention, just written once and compiled through unchanged.

This is a deliberate divergence from Ripple, the one other profile that scopes via generated class hashes. A tool or agent trained on Ripple's CSS model will misdescribe Le Truc's — state this profile explicitly wherever such tooling might be pointed at a `.tsrx` source.

The compiler does not currently parse or validate selectors — an author who forgets the tag-name prefix gets a working but globally-leaking stylesheet, not a compile error. This is a documentation-only guarantee for now (see "Open questions" below).

## `truc:pass` is host-owned, not a TSRX deviation

Core TSRX defines no attribute semantics at all — every attribute's meaning is host-defined. Le Truc uses the namespaced form `truc:pass={{ ... }}` (`JSXNamespacedName` is grammar-native) for client-side signal interop with a custom-element target. The namespace prefix avoids collision with a user-defined prop literally named `pass`, and matches the ecosystem convention of namespacing host-owned attributes. It lowers to a `pass(target, { ... })` call (ADR [0011](adr/0011-throw-on-pass-binding-failure.md), ADR [0012](adr/0012-deprecate-unrestricted-write-short-forms-in-pass.md)).

## Element references are `first()`-based, never `ref={}`

Le Truc has no `ref={}` binding. An author declares `const el = first(selector, required?)`, resolved structurally against the template on the server and via the DOM on the client. Selector-literal types infer precise, non-nullable element types through `HTMLElementTagNameMap` (e.g. `first('input, textarea', 'required')` → `HTMLInputElement | HTMLTextAreaElement`).

## Lazy destructuring does not apply

Core TSRX's `&{` / `&[` lazy-pattern introducers (`LazyObjectBindingPattern`, `LazyArrayBindingPattern`) have no role in this profile. Le Truc's server composition requires eager snapshot evaluation to generate markup — a lazily-destructured binding has nothing to evaluate against at render time. The compiler rejects `&{}`/`&[}` outright (diagnostics TSRX018/TSRX020; see `server/tsrx/LE_TRUC_COMPILER.md`). This is enforced, not just documented — the one item in this profile that graduated from a doc note to a compiler diagnostic once real authoring surfaced the ambiguity.

## Statements before output are legal

`TemplateBlock : { StatementListItemList TemplateOutput }` is grammar-native and Le Truc uses it as-is: a `@if` / `@for` / `@switch` / `@try` body may contain statements before its single output node. This is already true in the compiler and needed no change — it is listed here because it is easy to assume otherwise coming from a host that forbids it.

## FactoryContext helpers require an explicit import

**Not yet implemented — see LT-079.** `.tsrx` sources declare a `FactoryContext` helper (`first`, `expose`, `watch`, `on`, `pass`, `host`, `all`, `provideContexts`, `requestContext`) with an ordinary `import { ... } from '@zeix/le-truc'` naming only what's used, not as an ambient global. The compiler errors when a helper is used without a matching import and warns when an imported helper is never used, both with fix-its to add or remove the import line.

This reverses the ambient-global design ADR 0024 originally specified — a `declare global` `globals.d.ts` contract with no authored import at all. Two things drove the reversal: TSRX syntax highlighters (VS Code, Zed, Neovim) do local, non-type-aware highlighting and have no visibility into TypeScript's ambient-global mechanism, so an ambient identifier rendered as plain unhighlighted text in every current editor; and every other named TSRX host profile exposes its runtime primitives via explicit import, not ambient scope — confirmed against Octane's own docs (`import { useState, useEffect } from 'octane'`) and the general TSRX spec. Le Truc's ambient design was a discovered-late outlier, not researched convention. See [ADR 0024](adr/0024-adopt-tsrx-as-isomorphic-component-format.md), sub-design 4, for the full rationale.

## Open questions for upstream

- The draft TSRX spec (dated June 2026) under-specifies several host-owned areas in practice — attribute semantics, style scoping, class generation — because few host profiles existed to specify them against. Ripple and Le Truc diverge sharply enough on some of these (style scoping in particular) that the spec text alone doesn't settle a new host's design.
- Whether "host-owned" extends to selector-scoping *enforcement* (should a host be allowed to lint or reject non-conforming CSS, or only to declare its own default) is not addressed at all.
