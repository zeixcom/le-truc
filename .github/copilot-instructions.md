# Copilot / AI Agent Instructions — le-truc

This file gives focused, actionable guidance for AI coding agents working on the `le-truc` repository.

Keep these goals in mind:
- Preserve the public API surface exported from `index.ts` / `index.js` / `types/index.d.ts`.
- Follow the component patterns in `src/component.ts` and DOM helpers in `src/ui.ts`.
- Prefer small, minimal changes and add or update `examples/` entries to demonstrate usage.

Quick project overview
- Language: TypeScript (targeted for publishing as ESM). Source entry is `index.ts`.
- Build: `bun` is used. Key scripts in `package.json`: `build:prod`, `build:dev`, `build`.
- Linting: `biome` via `bunx biome` (scripts `lint` and `lint:examples`).
- Types: shipped in `types/` and referenced by `types/index.d.ts`.
- Examples: `examples/` show canonical usage (each example has `.html`, `.ts`, and optional `.css`).

Important patterns & conventions (use these exactly)
- Components: Use the `component(name, props, select, setup)` helper in `src/component.ts`.
  - `name` must include a hyphen and match `/^[a-z][a-z0-9-]*$/` (see validation in `component`).
  - `props` initializers can be: plain values, `Signal`s, parser functions from `src/parsers/*`, or initializer callbacks.
  - Parsers used for attributes are auto-added to `observedAttributes`. See `static observedAttributes`.
- Parsers: Implement parser functions following `src/parsers/*` signatures and export them from `src/parsers/index`.
  - Example builtin parser: `asJSON` in `src/parsers/json.ts` — when used as a prop initializer it will parse attribute strings.
- UI helpers & dependencies: Use `getHelpers(host)` from `src/ui.ts` to obtain `first`, `all` and automatic dependency detection.
  - If `getHelpers` finds a not-yet-defined custom element, it adds that tag to the dependency list; `component` waits for `customElements.whenDefined`.
  - There is a dependency timeout (`DEPENDENCY_TIMEOUT = 50`) in `src/component.ts` — expect code to try running effects even if deps time out.
- Effects & reactive model: This repo uses `@zeix/cause-effect` signals/computed/effects. Keep side-effects inside `runEffects` and cleanup in returned cleanup functions.

Files to consult for examples and authoritative patterns
- Public API: `index.ts`
- Component implementation & lifecycle: `src/component.ts`
- Selector helpers & mutation-observer logic: `src/ui.ts`
- Parser implementations: `src/parsers/*.ts` (e.g. `json.ts`, `number.ts`, `string.ts`)
- Effects: `src/effects/*.ts` and `src/effects/index` exports
- Examples demonstrating usage: `examples/*` (start from `basic-hello` and `basic-counter`)

Developer workflows (essential commands)
- Build production bundle: `bun run build:prod`
- Build dev bundle: `bun run build:dev`
- Full build + typecheck + lint: `bun run build` (runs `tsc` via `bunx tsc` and `biome`)
- Lint source: `bun run lint`
- Lint examples: `bun run lint:examples`

What to change (and what to avoid)
- Change: small refactors that preserve exported API in `index.ts` and `.d.ts` files.
- Change: add or update examples in `examples/` to demonstrate new or changed behavior.
- Avoid: breaking changes to public exports without updating `types/` and `index.ts`.
- Avoid: changing the custom element registration pattern (i.e., calling `customElements.define`) in a way that prevents `getHelpers` dependency detection.

PR guidance / descriptions
- Describe intent: feature, bugfix, or refactor. Note whether public API changed.
- If API changes: list required updates to `types/`, `index.ts`, and `examples/`.
- Test by: building (`bun run build:dev`) and verifying relevant example under `examples/`.

Examples (copyable patterns)
- Define a component (refer `src/component.ts`):
  - `component('my-widget', { count: 0, value: asJSON }, q => ({ btn: q.first('button') }), ui => ({ btn: run => ... }))`
- Parser signature (refer `src/parsers/json.ts`):
  - `const parser = (ui, value, old) => parsedValue` — return value becomes the property value.