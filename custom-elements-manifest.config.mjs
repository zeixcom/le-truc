import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { leTrucPlugin } from '@zeix/cem-plugin-le-truc'

let typeChecker

// The migrated corpus (.tsrx components) is read from its GENERATED clients
// in server/generated/tsrx/ — the plugin extracts the same declarations from
// the generated defineComponent() shape (ADR 0023, LT-006). Since the site
// cutover (LT-092) the hand-written .ts twins are deleted per component, so
// nearly all exclusions are gone — main.ts imports the generated clients
// directly and every compiled component declares its tag exactly once.
// basic-gauge and basic-pluralize were cut over in LT-115, basic-number in
// LT-114, form-radiogroup in LT-116 (the loop-body dirty-flag dispatch
// widening), basic-button in LT-117 (enhancer mode — the template-less
// light-DOM enhancer contract).
// Since LT-285 (ADR 0039) variant sets bring the twins back: a folder may
// carry the hand-written .ts twin beside the compiled .tsrx/.tsx spellings.
// The twin is the set's artifact of record but NOT its CEM declaration — the
// component is compiled, and the generated client owns the declaration. The
// exclusion below is derived from the variant set itself (a .ts glob hit
// whose stem has a same-directory .tsrx or .tsx sibling), so the next
// variant set needs no config edit. verify-cem.ts's duplicate-tag check is
// the acceptance.
// Run `bun run scripts/build-tsrx.ts` (or build:docs / build:examples:js,
// which both sequence the compiler first) before `cem analyze` — the
// generated output is gitignored.

/** A hand-written .ts twin of a compiled sibling — a variant set's record. */
const isVariantTwin = glob =>
	glob.endsWith('.ts') &&
	['.tsrx', '.tsx'].some(ext => existsSync(glob.replace(/\.ts$/, ext)))

export default {
	globs: ['examples/**/*.ts', 'server/generated/tsrx/*.client.ts'],
	exclude: ['**/*.spec.ts', '**/*.test.ts'],
	outdir: '.',
	plugins: [leTrucPlugin(() => typeChecker)],
	overrideModuleCreation({ ts, globs }) {
		const requested = globs.filter(g => !isVariantTwin(g))
		const program = ts.createProgram(requested, {
			target: ts.ScriptTarget.ESNext,
			lib: ['lib.esnext.d.ts', 'lib.dom.d.ts'],
		})
		typeChecker = program.getTypeChecker()
		// `program.getSourceFiles()` includes every file transitively reachable
		// from `globs` (i.e. all of src/), not just the example modules we want
		// analyzed. src/component.ts's `customElements.define(name, Truc)` is
		// then misdetected as a real custom element by the default analyzer's
		// heuristic (unresolvable `name` identifier -> literal tagName "name"),
		// producing a garbage declaration verify-cem.ts rejects. Restrict the
		// returned modules to the requested files; src/ is still fully
		// type-checked via the shared `typeChecker`.
		//
		// Comparison is on resolved paths: root files that nothing imports
		// keep their RELATIVE given name in `getSourceFiles()` (files reached
		// as import resolutions are absolute and deduped over the root entry).
		// Comparing raw names silently dropped such files — examples/main.ts
		// (latent) and every generated client (LT-006).
		const analyzed = new Set(requested.map(g => resolve(g)))
		return program
			.getSourceFiles()
			.filter(sf => analyzed.has(resolve(sf.fileName)))
	},
}
