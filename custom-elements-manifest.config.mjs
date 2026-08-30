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
// Run `bun run scripts/build-tsrx.ts` (or build:docs / build:examples:js,
// which both sequence the compiler first) before `cem analyze` — the
// generated output is gitignored.
export default {
	globs: ['examples/**/*.ts', 'server/generated/tsrx/*.client.ts'],
	exclude: ['**/*.spec.ts', '**/*.test.ts'],
	outdir: '.',
	plugins: [leTrucPlugin(() => typeChecker)],
	overrideModuleCreation({ ts, globs }) {
		const program = ts.createProgram(globs, {
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
		const requested = new Set(globs.map(g => resolve(g)))
		return program
			.getSourceFiles()
			.filter(sf => requested.has(resolve(sf.fileName)))
	},
}
