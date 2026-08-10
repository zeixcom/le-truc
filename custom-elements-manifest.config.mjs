import { resolve } from 'node:path'
import { leTrucPlugin } from '@zeix/cem-plugin-le-truc'

let typeChecker

export default {
	globs: ['examples/**/*.ts'],
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
		// returned modules to the requested example files; src/ is still fully
		// type-checked via the shared `typeChecker`.
		const requested = new Set(globs.map(g => resolve(g)))
		return program.getSourceFiles().filter(sf => requested.has(sf.fileName))
	},
}
