# TODO

## CEM plugin: `@zeix/cem-plugin-le-truc`

- [x] LT-001: Scaffold the `@zeix/cem-plugin-le-truc` npm package
  **Skill:** le-truc-dev
  **Context:** Create a new repository/package for `@zeix/cem-plugin-le-truc`. It is a peer to `@zeix/le-truc`, not a subdirectory. Required files: `package.json` (name `@zeix/cem-plugin-le-truc`, ESM, peer deps `@custom-elements-manifest/analyzer ^0.11` and `typescript ^5.0`), `tsconfig.json` (targeting ESNext, moduleResolution bundler), `src/index.ts` exporting a plugin factory function shell, and a `README.md` stub. Build with `bun build`. See ARCHITECTURE.md §Ecosystem Tooling for the plugin's role.

- [x] LT-002: Implement `defineComponent` call detection and tag/JSDoc extraction
  **Skill:** le-truc-dev
  **Context:** In `src/index.ts`, implement the `analyzePhase` hook. For each AST node, check if it is a `CallExpression` where the callee identifier text is `defineComponent` (i.e. `ts.isCallExpression(node) && node.expression.getText() === 'defineComponent'`). Extract the tag name from `node.arguments[0]` (must be a string literal). Derive the `name` field as PascalCase from the tag name. Extract the description from the JSDoc of the nearest ancestor `VariableDeclaration` or `ExportAssignment`. Create a `CustomElementDeclaration` shell (`kind: 'class'`, `customElement: true`, `tagName`, `name`, `description`) and push it to `moduleDoc.declarations`. Also push a `custom-element-definition` export entry so the tag is registered in the module's exports. See ARCHITECTURE.md §Ecosystem Tooling for the full extraction table.

- [x] LT-003: Implement `Props` type resolution via the TypeScript type checker
  **Skill:** le-truc-dev
  **Context:** Requires `overrideModuleCreation` in the consumer's config (see LT-009 for how it is wired up in le-truc). The plugin factory should accept a `() => ts.TypeChecker` getter as its argument (a closure set in `overrideModuleCreation`). In `analyzePhase`, when a `defineComponent` call is found, get the type argument node from `node.typeArguments[0]`. Call `typeChecker.getTypeFromTypeNode(typeArgNode)` then `typeChecker.getPropertiesOfType(propsType)` to get `ts.Symbol[]`. For each symbol, build a `ClassField` entry: `kind: 'field'`, `name: symbol.getName()`, `type.text` from `typeChecker.typeToString(typeChecker.getTypeOfSymbol(symbol))`, and `description` from the symbol's JSDoc comment. Push to `declaration.members`. `Props` is always the source of truth for `members` — even if `expose()` is absent. See ADR 0010 §Decision for the rationale.

- [x] LT-004: Implement `expose({…})` traversal to identify attribute-backed properties
  **Skill:** le-truc-dev
  **Context:** After building `members` in LT-003, traverse the factory function body (second argument of the `defineComponent` call) to find a `CallExpression` whose callee identifier is `expose`. Inspect the `ObjectLiteralExpression` argument. For each `PropertyAssignment`, check if the initializer is a `CallExpression` whose callee text matches: (a) any `as*` identifier imported from `@zeix/le-truc` (e.g. `asBoolean`, `asInteger`, `asString`, `asEnum`, `asJSON`, `asNumber`, `asClampedInteger`), or (b) `asParser`. Use the `collectPhase` to build an import map keyed by local name → module specifier, so you can distinguish `asBoolean` from `@zeix/le-truc` from a user-defined function named `asBoolean`. For each matched property name, add an `Attribute` entry to `declaration.attributes`: `name: propertyName`, `fieldName: propertyName`, `type` copied from the matching `ClassField`. If no `expose()` call is found, `attributes` remains empty — this is not an error.

- [x] LT-005: Implement JSDoc tag extraction (`@slot`, `@fires`, `@csspart`, `@cssprop`)
  **Skill:** le-truc-dev
  **Context:** Extend the `analyzePhase` detection (LT-002). After finding the `defineComponent` call, walk up to the export's JSDoc tags. For each tag: `@slot name - description` → push to `declaration.slots` (`name`, `description`); anonymous `@slot - description` (no name) → push with `name: ''`; `@fires event-name - description` → push to `declaration.events` (`name`, `type.text: 'CustomEvent'`, `description`); `@csspart name - description` → push to `declaration.cssParts`; `@cssprop --name - description` → push to `declaration.cssProperties`. Use the TypeScript JSDoc API (`node.jsDoc`, `tag.tagName.getText()`, `tag.comment`). If no tags are present, the arrays remain empty — the manifest is still valid.

- [x] LT-006: Write tests for the plugin against Le Truc component fixtures
  **Skill:** le-truc-dev
  **Context:** Use `@custom-elements-manifest/analyzer`'s `create` function (it accepts `{ globs, plugins }` and returns a manifest object) to run the plugin against small TypeScript fixture files. Cover: (1) basic component — tag name, PascalCase name, Props members; (2) Parser-backed attributes via `asInteger()`, `asBoolean()`, `asString()`; (3) JSDoc tags `@slot`, `@fires`, `@csspart`, `@cssprop`; (4) component with no `expose()` call — members from Props, attributes empty; (5) `HTMLElementTagNameMap` augmentation present; (6) custom parser via `asParser()`. Assert the full shape of the generated `CustomElementDeclaration`.

## Le Truc integration

- [x] LT-007: Add `custom-elements-manifest.config.mjs` and `build:cem` script to le-truc — done ✓
  **Skill:** le-truc-dev
  **Changed:** `package.json` (`"customElements": "custom-elements.json"`, `"build:cem": "cem analyze"`), `custom-elements-manifest.config.mjs`, devDependency `@custom-elements-manifest/analyzer ^0.11.0`.
  **How:** Config uses `overrideModuleCreation` to expose the TS type checker to the plugin via a closure, globs `examples/**/*.ts` excluding tests. Plugin resolved via `bun link` pending npm publish of `@zeix/cem-plugin-le-truc` (see LT-011). `bun run build:cem` now produces a real manifest: 47 components, 82 members, 17 attributes, 16 cssProperties, 4 components with `@cssprop` tags. Attribute detection works for relative imports after the LT-010 fix.
  **Verified:** `bun run build:cem` loads the plugin (no `ERR_MODULE_NOT_FOUND`), emits valid schemaVersion 1.0.0 manifest. Member types, JSDoc descriptions, attribute/field distinction all correct (spot-checked `module-coloreditor`).
  **Caveat:** `bun link` resolution is local to this clone; CI and fresh clones will break until LT-011 (npm publish) lands.

- [x] LT-008: Add JSDoc annotations to example components — done ✓
  **Skill:** le-truc-dev
  **Context:** Added description comments and property-level JSDoc to all example components in `examples/basic/`, `examples/form/`, `examples/card/`, `examples/context/`, and `examples/module/`. `@cssprop` tags added to `basic-gauge`, `card-colorscale`, `module-colorinfo`, and `module-splitview`. No explicit `@slot` or `@fires` tags needed (components use light DOM; no `CustomEvent` dispatches found).

- [x] LT-009: Configure `cem lsp` and `cem mcp` for the le-truc dev environment — done ✓
  **Skill:** le-truc-dev
  **Done:** `.vscode/settings.json` (`html.customData` → `custom-elements.json`), `CONTRIBUTING.md` setup instructions for VS Code + Zed + `cem mcp`, `custom-elements.json` gitignored. `.mcp.json` is deliberately a gitignored per-developer file (opt-in), not a committed artifact.
  **Resolved via LT-011:** `@pwrs/cem` is **not** a project dependency — by decision. CONTRIBUTING.md now documents `cem lsp`/`cem mcp` as optional editor/AI tooling (not "required"), and clarifies that `cem analyze` (used by `build:cem`) is already bundled via `@custom-elements-manifest/analyzer`. The local `.bin/cem` resolves to the analyzer's `cem.js`.

## Post-audit follow-ups

- [x] LT-010: Publish `@zeix/cem-plugin-le-truc` to npm via provenance-checked release workflow — done ✓
  **Skill:** le-truc-dev
  **Done:** `@zeix/cem-plugin-le-truc@0.1.0` published with provenance. Workflow (`.github/workflows/npm-publish.yml` in the plugin repo) created with OIDC trusted publishing + test gate; `package.json` `"files"` allowlist added so the gitignored `dist/` ships. le-truc now resolves the plugin from the npm registry (`@zeix/cem-plugin-le-truc@^0.1.0` devDependency), no longer via `bun link`. `bun run build:cem` confirmed working.
  **Reference for future releases:** trigger on `release: [published]`; never publish locally (breaks provenance). See ADR 0013.

- [x] LT-011: Decide on `@pwrs/cem` as a dependency vs. documented global install — decided ✓
  **Skill:** architect
  **Decision: keep `@pwrs/cem` a documented global install, not a devDependency (Option C).** `@pwrs/cem` is a ~58 MB native binary (platform-specific via `optionalDependencies`) that provides only the *optional* `cem lsp` (editor autocomplete) and `cem mcp` (AI agent) features. It is not needed to build, test, or contribute — `cem analyze` (used by `build:cem`) is already bundled via `@custom-elements-manifest/analyzer`. The 58 MB cost is unjustifiable in every contributor's `node_modules` for an opt-in editor feature.
  **Done:** CONTRIBUTING.md rewritten — the misleading "(required)" label removed; `cem lsp`/`cem mcp` reframed as optional editor/AI tooling; the `analyze` (bundled) vs `lsp`/`mcp` (global install) split made explicit. ARCHITECTURE.md §Ecosystem Tooling status note aligned. Closes the only open item from LT-009.

- [x] LT-012: Add CI guard so `build:cem` fails when the plugin fails to load — done ✓
  **Skill:** le-truc-dev
  **Changed:** `scripts/verify-cem.ts` (new guard), `package.json` (`build:cem` now chains `cem analyze && bun run verify:cem`; new `verify:cem` script), `.github/workflows/ci-cd.yml` (new "Generate & verify Custom Elements Manifest" step).
  **How:** `verify-cem.ts` asserts every custom-element declaration name is PascalCase (`/^[A-Z][a-zA-Z0-9]+$/`) and rejects `anonymous*`, `Truc`, `J`, and empty names. The plugin always synthesises PascalCase from the tag name, so a non-PascalCase name reliably signals the plugin did not run. Wired into `build:cem` so the guard runs everywhere the manifest is generated (local + CI), and added as a CI step after `Build` so a broken plugin fails the job.
  **Verified:** Healthy plugin → `✅ 47 declarations, all PascalCase` (exit 0). Broken plugin (import renamed to `@zeix/cem-plugin-le-truc-NONEXISTENT`) → guard lists the garbage declarations and exits 1. The exact silent-failure mode that shipped the broken "47-component manifest that didn't exist" is now caught loudly.

- [x] LT-013: Filter structural-only stub elements out of the manifest — done, then superseded by LT-014a ⏻
  **Skill:** le-truc-dev
  **Original approach (reverted):** Excluded `examples/main.ts` from the globs. This dropped the 6 `anonymous_N` noise declarations (53 → 47) but broke LSP awareness — the docs HTML uses those container elements (`<card-callout>`, `<section-hero>`, etc.), and without them in the manifest `cem lsp` reports "Unknown custom element". See LT-014a for the corrected approach.

- [x] LT-014: Document structural stubs + record cem-lsp global-bundle false positive — done ✓
  **Skill:** le-truc-dev
  **Context:** Surfaced by actually running `cem lsp` in Zed. Two issues: (1) the 6 structural stubs showed as "Unknown custom element" after LT-013's exclusion; (2) `cem lsp` emits "is not imported" diagnostics for every Le Truc element in HTML — a false positive under the global-bundle architecture.
  **Changed:** `examples/main.ts` (6 inline `class extends HTMLElement {}` → named class declarations with JSDoc descriptions), `custom-elements-manifest.config.mjs` (reverted the `!examples/main.ts` exclusion from LT-013), `CONTRIBUTING.md` (note explaining the "is not imported" false positive).
  **How:**
    - **Stubs (Issue #1):** The default CEM analyzer does NOT extract metadata from inline class expressions (tested: JSDoc on `customElements.define('x', class extends HTMLElement {})` is ignored). Converting to named declarations (`class CardCallout extends HTMLElement {}` + JSDoc) gives proper PascalCase names + descriptions. Now `cem lsp` recognizes all 6 as known elements with hover docs. Manifest back to 53 declarations, all PascalCase — `verify:cem` still passes.
    - **"Is not imported" (Issue #2):** `cem-lsp` exposes no config option to disable just the missing-import diagnostic (only `additionalPackages` and `trace` are documented; the check is baked into `publishDiagnostics`). Documented as a known false positive in CONTRIBUTING.md with the reason (global bundle, no per-file imports). Hover/autocomplete/tag-validation all work; only the import suggestion is noise.
  **Verified:** `bun run build:cem` → `✅ 53 declarations, all PascalCase`. `examples/main.ts` lints clean and bundles successfully.

