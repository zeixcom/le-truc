# PLAN: `@attribute` JSDoc tag for connect-time (non-reactive) attributes in the CEM manifest

## Goal

Le Truc components can read host attributes once at connect time without converting them to
reactive properties via `expose()` — the idiom for server-side configuration of client-side
behavior that is meant to remain stable:

- `module-splitview` reads `orientation` (`host.getAttribute('orientation') === 'vertical'`) —
  `examples/module/splitview/module-splitview.ts:32`
- `context-media` reads the `sm`/`md`/`lg`/`xl` breakpoint attributes —
  `examples/context/media/context-media.ts:43`

These attributes are part of the component's public markup API, but they are invisible to
`@zeix/cem-plugin-le-truc`: the plugin derives `attributes[]` exclusively from `as*` parser
calls inside `expose()` (ADR 0013, Decision 4). The generated `custom-elements.json` therefore
under-documents these components — `cem lsp` won't autocomplete `orientation="vertical"`,
and `cem mcp` won't tell an agent the attribute exists.

Fix: support a JSDoc `@attribute` tag (alias `@attr`) on the component's export declaration,
parsed by the plugin into `attributes[]` entries **without** a `fieldName` — the CEM schema's
way of saying "attribute with no corresponding property".

## Why JSDoc `@attribute` (ecosystem check)

This is the established ecosystem convention, not an invention:

- **`@custom-elements-manifest/analyzer`** natively supports `@attr` / `@attribute` JSDoc tags
  on class-based components for exactly this case (attributes not statically derivable from
  code). We can't reuse its built-in handling — it only runs on real `ClassDeclaration` nodes,
  and our declarations are synthesised from `defineComponent()` calls — but we adopt the same
  tag names and syntax so authors coming from Lit/vanilla CEM projects find familiar behavior.
- **`web-component-analyzer`** (runem), Lit-ecosystem tooling, and VS Code custom-data
  generators all recognize `@attr`/`@attribute`.
- The CEM schema's `Attribute` type makes `fieldName` optional by design — an attribute
  without one is the spec-blessed representation of "read but not reflected as a property".

Alternatives considered and rejected:

- **A library helper** (e.g. `fromAttribute(host, 'orientation', asEnum(...))`) that the plugin
  detects statically. Adds runtime API surface to solve a documentation problem; the whole point
  of the idiom is that a plain platform `getAttribute()` call suffices. Could be revisited later
  if type-safe parsing of connect-time attributes becomes a need of its own.
- **Sidecar manifest / config file** listing extra attributes. Fragments the source of truth
  away from the component file; no ecosystem precedent.
- Note this does **not** conflict with ADR 0013's rejection of a "JSDoc-only manifest":
  that rejection was about duplicating information already present in TypeScript types.
  Connect-time attributes have no `Props` entry and no type-level representation — JSDoc is
  the *only* possible source, exactly like the existing `@slot`/`@fires`/`@csspart`/`@cssprop`
  handling.

## Tag syntax

```
@attribute {type} name - description
@attribute {type} [name=default] - description
@attr      {type} name - description          (alias)
```

- `{type}` optional → `attribute.type.text`
- `[name=default]` square-bracket form optional → `attribute.default`
- `- description` optional, same `parseNameDesc` conventions as `@slot`/`@fires`

Example (module-splitview):

```ts
/**
 * A resizable split view with a draggable divider and keyboard support.
 * ...
 * @attribute {'horizontal'|'vertical'} orientation - Layout direction. Read once at connect time; defaults to horizontal.
 */
```

Emitted CEM entry (no `fieldName` — deliberately):

```json
{
  "name": "orientation",
  "type": { "text": "'horizontal'|'vertical'" },
  "description": "Layout direction. Read once at connect time; defaults to horizontal."
}
```

## Exact files to touch

### Repo `cem-plugin-le-truc` (sibling checkout `../cem-plugin-le-truc`)

| File | Change |
|---|---|
| `src/index.ts` | Add `attr`/`attribute` cases to the JSDoc tag `switch` in `analyzePhase`; new `parseAttributeTag()` helper; merge rule against `expose()`-derived entries |
| `src/index.test.ts` | New tests: bare tag, `{type}`, `[name=default]`, alias `@attr`, merge/conflict with `expose()`-derived attribute |
| `package.json` | Version bump `0.1.x` → `0.2.0` (additive feature) |
| `README.md` | Document the tag |

### Repo `le-truc`

| File | Change |
|---|---|
| `package.json` | Bump devDependency `@zeix/cem-plugin-le-truc` to `^0.2.0` |
| `examples/module/splitview/module-splitview.ts` | Add `@attribute` tag for `orientation` |
| `examples/context/media/context-media.ts` | Add `@attribute` tags for `sm`, `md`, `lg`, `xl` |
| `adr/0013-cem-plugin-for-le-truc-factory-pattern.md` | Amend via adr-keeper: add `@attribute`/`@attr` extraction to the Decision section |
| `CHANGELOG.md` | `### Added` entry under `## 2.2.0 (Unreleased)` |
| `CONTRIBUTING.md` | One sentence in the CEM tooling section: how to declare connect-time attributes |

## Step-by-step implementation plan

### Step 1 — `parseAttributeTag()` in `cem-plugin-le-truc/src/index.ts`

Parse the tag comment text (the analyzer's `tag.comment` for `@attr` may arrive as a
`JSDocPropertyLikeTag`-ish node with `typeExpression`/`name` already split, or as plain text —
handle both by falling back to text parsing on `tag.getText()`-derived content):

```ts
interface ParsedAttribute {
  name: string;
  type?: string;      // from {type}
  default?: string;   // from [name=default]
  description: string;
}
```

Text grammar: optional leading `{...}` (brace-balanced scan, same approach as the existing
`@demo` handling), then a name token — if wrapped in `[name=value]`, split out the default —
then reuse `parseNameDesc()` for the `name - description` split of the remainder.

### Step 2 — Wire into the JSDoc tag switch

In the existing `switch (tn)` block (`src/index.ts:290`), add:

```ts
case "attr":
case "attribute": {
  const parsed = parseAttributeTag(commentText);
  if (!parsed.name) break;
  const attrs = declaration.attributes as Array<Record<string, unknown>>;
  const existing = attrs.find((a) => a.name === parsed.name);
  if (existing) {
    // Merge with an expose()-derived entry: Props type stays the source of
    // truth for `type` (ADR 0013), JSDoc supplies what static analysis can't.
    if (!existing.description && parsed.description)
      existing.description = parsed.description;
    if (!existing.type && parsed.type) existing.type = { text: parsed.type };
    if (parsed.default != null) existing.default = parsed.default;
  } else {
    attrs.push({
      name: parsed.name,
      ...(parsed.type ? { type: { text: parsed.type } } : {}),
      ...(parsed.default != null ? { default: parsed.default } : {}),
      ...(parsed.description ? { description: parsed.description } : {}),
      // No fieldName: this is the CEM representation of an attribute
      // that is not backed by a property.
    });
  }
  break;
}
```

Ordering note: the JSDoc extraction already runs *after* the `expose()` traversal in
`analyzePhase`, so the merge rule sees all parser-derived attributes — no restructuring needed.

### Step 3 — Plugin tests (`cem-plugin-le-truc/src/index.test.ts`)

1. `@attribute {string} orientation - desc` → entry with name/type/description, **no** `fieldName`
2. `@attr` alias produces the identical entry
3. `[split=0.5]` default form → `default: "0.5"`
4. Tag name colliding with an `expose()`-derived attribute → single merged entry, `fieldName`
   preserved, Props-derived `type` preserved, JSDoc description filled in
5. Tag with no name (`@attribute - dangling`) → ignored, no crash
6. Type containing braces/pipes (`{'a'|'b'}`) parses intact

### Step 4 — Release plugin, bump consumer

Bump `@zeix/cem-plugin-le-truc` to `0.2.0`, publish to npm, then in le-truc:
`bun update @zeix/cem-plugin-le-truc` (devDependency `^0.2.0`).

### Step 5 — Annotate the two known components

- `module-splitview`: `@attribute {'horizontal'|'vertical'} orientation - Layout direction of the split. Read once at connect time; defaults to horizontal.`
- `context-media`: four tags, e.g. `@attribute {string} sm - Small breakpoint as a CSS length (e.g. \`600px\` or \`40em\`). Read once at connect time.`

Then `bun run build:cem` and spot-check `custom-elements.json`: both components list the new
attributes without `fieldName`; `verify:cem` still passes (it only asserts declaration names,
unaffected).

Scope note — `module-codeblock`'s `copy-success`/`copy-error` are read from a **child**
`basic-button` element, not from the host. CEM attributes describe the host element only, so
these are deliberately *not* annotated on `module-codeblock`. (They are also not attributes of
`basic-button`-in-general, so they don't belong on `BasicButton` either; documenting
slotted-content contracts stays in the component description, as today.)

### Step 6 — Documentation

- **ADR 0013** (via adr-keeper): extend Decision item 5 to include `@attribute`/`@attr`, and add
  a sentence distinguishing this from the rejected "JSDoc-only manifest" alternative (no type-level
  source exists for connect-time attributes).
- **CHANGELOG.md** `### Added`: `@attribute`/`@attr` JSDoc tag support, with the
  `module-splitview`/`context-media` examples and the no-`fieldName` semantics.
- **CONTRIBUTING.md**: one sentence in the CEM section pointing authors at the tag.

## Verification

1. `cd ../cem-plugin-le-truc && bun test` — new plugin tests green
2. `bun run build:cem` in le-truc — regenerates manifest, `verify:cem` passes
3. Manual: `orientation`, `sm`/`md`/`lg`/`xl` present in `custom-elements.json` with types and
   descriptions and without `fieldName`; existing `expose()`-derived attributes unchanged
4. Full le-truc suite (`bun test`, Playwright) unaffected — no runtime code changes in le-truc

## Related finding (release-blocking) — RESOLVED

While verifying the CEM feature: the generated manifest's module `path` values were **absolute
local paths** (`/Users/estherbrunner/Documents/GitHub/le-truc/examples/...`). Since
`npm-publish.yml` runs `build:cem` before publishing and `custom-elements.json` is in the
`files` allowlist, the published manifest would have carried CI-runner paths
(`/home/runner/...`) — non-portable and schema-non-conformant (CEM paths must be
package-root-relative). Root cause: `overrideModuleCreation` in
`custom-elements-manifest.config.mjs` feeds absolute `sf.fileName`s to the analyzer.

**Fixed** in `@zeix/cem-plugin-le-truc` 0.2.1: `packageLinkPhase` relativizes every
`path`/`module` string under `process.cwd()` (paths outside cwd untouched), with regression
tests. `verify-cem.ts` now fails on absolute module paths, so a downgrade or plugin failure
cannot silently reintroduce the leak.
