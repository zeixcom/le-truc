/**
 * The examples layout graph (`examples/main.ts`) registers each variant set
 * through its compiled client, never through its hand-written `.ts` twin
 * (ADR 0039, LT-467). The graph is the default page bundle and the base of
 * every `test:variants` surface bundle (`buildSurfaceBundle` in routes.ts),
 * which empties only the generated-client slot: a twin imported here holds
 * the tag first, so the compiled spellings never run in a browser and the
 * appended surface module's `define` throws.
 */
import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(import.meta.dir, '../..')
const MAIN = path.join(ROOT, 'examples/main.ts')

/**
 * Empty since LT-485 switched the last three twins (module-calctable,
 * module-cem-list, module-ticker) to their compiled clients. The inverted
 * assertion below is the standing guard: any twin import added to the
 * graph fails this test until the set names it.
 */
const KNOWN_TWIN_IMPORTS = new Set<string>()

/** The tags of the variant-set twins `main.ts` imports directly. */
const importedTwins = (): string[] =>
	[...readFileSync(MAIN, 'utf8').matchAll(/^import '\.\/(.+)\.ts'$/gm)]
		.map(match => match[1] ?? '')
		.filter(rel =>
			['tsrx', 'tsx'].some(ext =>
				existsSync(path.join(ROOT, 'examples', `${rel}.${ext}`)),
			),
		)
		.map(rel => path.basename(rel))
		.sort()

describe('the examples layout graph', () => {
	test('imports no variant-set twin', () => {
		expect(importedTwins()).toEqual([...KNOWN_TWIN_IMPORTS].sort())
	})

	test('module-todo registers its compiled client', () => {
		const source = readFileSync(MAIN, 'utf8')
		expect(source).toContain(
			"import '../server/generated/components/module-todo.client.ts'",
		)
		expect(source).not.toContain("import './module/todo/module-todo.ts'")
	})
})
