# ADR 0010: Custom Elements Manifest via `@custom-elements-manifest/analyzer` Plugin

## Status

✅ Accepted

## Context

Le Truc components are defined via `defineComponent<Props>(tagName, factory)` — a function call, not a class declaration. Standard CEM tooling (`@custom-elements-manifest/analyzer`, `bennypowers/cem generate`) is designed for class-based components with decorators and has no built-in support for this pattern. Without a Custom Elements Manifest, Le Truc components cannot benefit from:

- **`cem lsp`**: Editor autocomplete, hover docs, and diagnostics in HTML templates
- **`cem mcp`**: AI-native component context for coding agents
- Standard documentation and design system tooling that consumes `custom-elements.json`

A separate package (`@zeix/cem-plugin-le-truc`) is needed to teach the analyzer how to extract component metadata from the Le Truc factory pattern. See REQUIREMENTS.md for the secondary persona (design system / component library author) and the TypeScript type safety requirements (M13).

## Decision

Write `@zeix/cem-plugin-le-truc` as a plugin for `@custom-elements-manifest/analyzer`. The plugin:

1. Uses `overrideModuleCreation` (in the consumer's `custom-elements-manifest.config.mjs`) to access the TypeScript type checker via `program.getTypeChecker()`.
2. In `analyzePhase`, detects `defineComponent<Props>(tagName, factory)` `CallExpression` nodes.
3. Resolves the `Props` type argument via `typeChecker.getTypeFromTypeNode()` + `typeChecker.getPropertiesOfType()` to build `members[]`. **`Props` is the source of truth for `members` — not `expose()`.**
4. Traverses the factory body for `expose({...})` calls and inspects each property initializer: if it is a call to an `as*` function imported from `@zeix/le-truc` (or a call to `asParser()`), the property is also listed in `attributes[]`.
5. Extracts `@slot`, `@fires`, `@csspart`, and `@cssprop` JSDoc tags from the export declaration to populate the corresponding CEM arrays.
6. Synthesises a PascalCase `name` from the tag name (e.g. `basic-counter` → `BasicCounter`) since the internal `Truc` class is private to `defineComponent`.

The plugin is published as `@zeix/cem-plugin-le-truc` and used internally by adding `custom-elements-manifest.config.mjs` to the le-truc repo targeting `examples/**/*.ts`.

## Alternatives Considered

- **Option B — Standalone Bun script**: Write a Bun script that calls the TypeScript compiler API directly and emits `custom-elements.json`. This gives more control but produces a non-standard pipeline: consumers cannot reuse it as a plugin, it does not integrate with `cem analyze --watch`, and cannot be combined with other CEM plugins. The TypeScript API work is identical to Option A, so there is no technical benefit to justify the ecosystem fragmentation.

- **`bennypowers/cem generate` with vanilla support**: The tool explicitly lists `extends HTMLElement` support as "rudimentary and not a priority." Le Truc components do not extend `HTMLElement` in source at all — they call `defineComponent()`. This option cannot work without significant upstream changes to a third-party tool.

- **JSDoc-only manifest (no TypeScript analysis)**: Require authors to annotate all types redundantly in JSDoc (e.g. `@type {number}`). Rejected: duplicates information already expressed precisely in TypeScript types; creates a maintenance burden and a second source of truth for types.

## Consequences

**Good:**
- Produces a standards-compliant `custom-elements.json` consumable by the full CEM ecosystem
- `cem lsp` and `cem mcp` work out of the box once the manifest is generated
- Reusable: any team building components with `@zeix/le-truc` can add the plugin to their own project
- Props types remain the authoritative source for member metadata — no duplication

**Bad:**
- `overrideModuleCreation` requires a small amount of boilerplate in the consumer's config file (5–8 lines); this cannot be hidden inside the plugin itself due to the analyzer's plugin API design
- Parser detection relies on the `as*` naming convention and import origin heuristic; custom parsers created without `asParser()` will not be detected as attributes (but this is already a bug per AGENTS.md: "Parser branding is required for reliable detection")
- Synthesised class names (`BasicCounter`) are not real class names and may look unusual in tooling that surfaces them

## Related

- Requirements: [M13](REQUIREMENTS.md#m13-typescript-types-exported-and-accurate), [Secondary persona](REQUIREMENTS.md#secondary-design-system--component-library-author)
- Architecture: [Ecosystem Tooling](ARCHITECTURE.md#ecosystem-tooling)
- ADR [0005](0005-branded-parsers-and-methods-with-symbol-based-branding.md) — Parser branding (relevant to attribute detection heuristic)
