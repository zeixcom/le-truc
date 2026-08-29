import { resolve } from 'node:path'
import { leTrucPlugin } from '@zeix/cem-plugin-le-truc'

let typeChecker

// The migrated corpus (.tsrx components) is read from its GENERATED clients
// in server/generated/tsrx/ — the plugin extracts the same declarations from
// the generated defineComponent() shape (ADR 0023, LT-006). Their
// hand-written .ts twins stay on disk as golden-test references but must not
// produce duplicate declarations, hence the excludes. Run
// `bun run scripts/build-tsrx.ts` (or build:docs) before `cem analyze` —
// the generated output is gitignored.
export default {
	globs: ['examples/**/*.ts', 'server/generated/tsrx/*.client.ts'],
	exclude: [
		'**/*.spec.ts',
		'**/*.test.ts',
		'examples/basic/counter/basic-counter.ts',
		'examples/basic/button/basic-button.ts',
		'examples/basic/hello/basic-hello.ts',
		'examples/basic/number/basic-number.ts',
		'examples/basic/pluralize/basic-pluralize.ts',
		'examples/basic/gauge/basic-gauge.ts',
		'examples/module/tabgroup/module-tabgroup.ts',
		'examples/module/list/module-list.ts',
		'examples/form/textbox/form-textbox.ts',
		'examples/form/checkbox/form-checkbox.ts',
		'examples/form/combobox/form-combobox.ts',
		'examples/form/inplace-edit/form-inplace-edit.ts',
		'examples/form/listbox/form-listbox.ts',
		'examples/form/radiogroup/form-radiogroup.ts',
		'examples/form/spinbutton/form-spinbutton.ts',
		'examples/form/colorgraph/form-colorgraph.ts',
		'examples/form/tokenbox/form-tokenbox.ts',
		'examples/card/collapsible/card-collapsible.ts',
		'examples/card/colorscale/card-colorscale.ts',
		'examples/card/mediaqueries/card-mediaqueries.ts',
	],
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
