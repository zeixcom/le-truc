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

- [~] LT-007: Add `custom-elements-manifest.config.mjs` and `build:cem` script to le-truc
  **Skill:** le-truc-dev
  **Status:** Pending review — `package.json` now has `"customElements": "custom-elements.json"` and `"build:cem": "cem analyze"`. Plugin linked locally via `bun link @zeix/cem-plugin-le-truc`. `overrideModuleCreation` wired; `bun run build:cem` generates 47-component manifest. Known gap: attribute detection is empty for self-analysis because examples use relative imports (`'../../..'`) instead of `@zeix/le-truc` — see NOTES.md.

- [x] LT-008: Add JSDoc annotations to example components
  **Skill:** le-truc-dev
  **Context:** Added description comments and property-level JSDoc to all example components in `examples/basic/`, `examples/form/`, `examples/card/`, `examples/context/`, and `examples/module/`. `@cssprop` tags added to `basic-gauge`, `card-colorscale`, `module-colorinfo`, and `module-splitview`. No explicit `@slot` or `@fires` tags needed (components use light DOM; no `CustomEvent` dispatches found).

- [x] LT-009: Configure `cem lsp` and `cem mcp` for the le-truc dev environment
  **Skill:** le-truc-dev
  **Context:** `@pwrs/cem` installed globally and documented in `CONTRIBUTING.md`. `.vscode/settings.json` created with `html.customData` pointing at `custom-elements.json`. Zed equivalent documented in `CONTRIBUTING.md`. `.mcp.json` created (gitignored) for `cem mcp`. `CONTRIBUTING.md` updated with full setup instructions for both editor and AI tooling.
