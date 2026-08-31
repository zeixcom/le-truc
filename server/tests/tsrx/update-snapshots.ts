/**
 * Regenerate the client-codegen golden snapshots. Run:
 *
 *   UPDATE_SNAPSHOTS=1 bun test server/tests/tsrx
 *
 * or directly: bun server/tests/tsrx/update-snapshots.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { compileComponent } from '../../tsrx'

const ROOT = path.resolve(import.meta.dir, '../../..')
const SNAPSHOTS = path.join(ROOT, 'server/tests/tsrx/snapshots')
const SOURCES = [
	'examples/basic/counter/basic-counter.tsrx',
	'examples/module/tabgroup/module-tabgroup.tsrx',
] as const

fs.mkdirSync(SNAPSHOTS, { recursive: true })
const registry = new Set<string>(['basic-counter', 'module-tabgroup'])
for (const rel of SOURCES) {
	const source = fs.readFileSync(path.join(ROOT, rel), 'utf8')
	const { component, diagnostics } = compileComponent(source, rel, registry)
	if (!component) throw new Error(`${rel}: ${JSON.stringify(diagnostics)}`)
	fs.writeFileSync(
		path.join(SNAPSHOTS, `${component.entry.tag}.client.ts.snap`),
		component.clientCode,
	)
	console.log(`wrote snapshot ${component.entry.tag}.client.ts.snap`)
}
