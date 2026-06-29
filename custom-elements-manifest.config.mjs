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
		return program.getSourceFiles().filter(sf => !sf.fileName.includes('node_modules'))
	},
}
