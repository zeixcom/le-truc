/**
 * Development smoke check (not a test file): compile the corpus sources,
 * emit server modules into server/generated/tsrx/, execute the render
 * functions, and print output next to diagnostics. Run:
 *
 *   bun server/tsrx/smoke.ts
 */
import * as fs from 'node:fs'
import { analyzeClient } from './analyze'
import { compileSource } from './compiler'
import { emitClientModule } from './emit-client'
import { emitServerModule } from './emit-server'

const ROOT = new URL('../..', import.meta.url).pathname
const OUT_DIR = 'server/generated/tsrx'
const CASES = [
	'examples/basic/counter/basic-counter.tsrx',
	'examples/module/tabgroup/module-tabgroup.tsrx',
	'examples/module/list/module-list.tsrx',
	'examples/form/textbox/form-textbox.tsrx',
] as const

fs.mkdirSync(`${ROOT}${OUT_DIR}`, { recursive: true })

// Registry-aware dispatch needs all compilable tags of the unit up front.
const registry = new Set<string>()
const compiled: Array<{ rel: string; tag: string }> = []
for (const rel of CASES) {
	const { component } = compileSource(
		fs.readFileSync(`${ROOT}${rel}`, 'utf8'),
		rel,
	)
	if (component) {
		registry.add(component.tag)
		compiled.push({ rel, tag: component.tag })
	}
}

for (const { rel, tag } of compiled) {
	const { component } = compileSource(
		fs.readFileSync(`${ROOT}${rel}`, 'utf8'),
		rel,
	)
	if (!component) continue
	const diagnostics = [
		...compileSource(fs.readFileSync(`${ROOT}${rel}`, 'utf8'), rel).diagnostics,
	]
	const server = emitServerModule(component, {
		runtimeImport: '../../tsrx/runtime',
		sourcePath: rel,
	})
	fs.writeFileSync(`${ROOT}${OUT_DIR}/${tag}.server.ts`, server.code)
	fs.writeFileSync(`${ROOT}${OUT_DIR}/${tag}.css`, component.css)
	const clientDiagnostics = [...diagnostics]
	const plan = analyzeClient(component, registry, clientDiagnostics)
	const client = emitClientModule(component, plan, { sourcePath: rel })
	fs.writeFileSync(`${ROOT}${OUT_DIR}/${tag}.client.ts`, client.code)
	console.log(`emitted ${tag} → .server.ts / .client.ts / .css`)
}

for (const { tag } of compiled) {
	const mod = await import(`../../${OUT_DIR}/${tag}.server.ts`)
	if (tag === 'basic-counter') {
		console.log(mod.renderBasicCounter({}))
		console.log(mod.renderBasicCounter({ start: 100 }))
	}
	if (tag === 'module-tabgroup') {
		const tabs = [
			{ id: '1', label: 'Tab 1', content: 'Tab 1 content' },
			{ id: '2', label: 'Tab 2', content: 'Tab 2 content' },
			{ id: '3', label: 'Tab 3', content: 'Tab 3 content' },
		]
		console.log(mod.renderModuleTabgroup({ tabs }))
	}
	if (tag === 'form-textbox') {
		console.log(
			mod.renderFormTextbox({ name: 'name', label: 'Name', required: true }),
		)
		console.log(
			mod.renderFormTextbox({ name: 'nick', label: 'Nickname', value: 'Ada' }),
		)
	}
}
