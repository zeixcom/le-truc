# Dev Notes

## LT-007: CEM attribute detection gap

`cem-plugin-le-truc` identifies attribute-backed props by checking whether each `expose()` initializer calls a function imported from `"@zeix/le-truc"`. This works correctly for downstream consumers.

However, le-truc's own example components import parsers via a relative path (`'../../..'`), so the plugin's import-map check never matches — the `attributes` array in the manifest remains empty for all example components.

**Impact:** Members (from the TypeScript type checker) and descriptions (from JSDoc) are correctly emitted. Only the `attributes` distinction is missing in the self-analysis manifest.

**Fix needed in `cem-plugin-le-truc`:** The `collectPhase` import map should also match relative paths that resolve to the package root (e.g. by comparing the resolved file path against the package's `index.ts`/`index.js`). This is plugin-level work separate from LT-007.
