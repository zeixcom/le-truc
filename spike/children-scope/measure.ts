/**
 * LT-465: served-byte cost of shape (a) on the corpus (shape (b) emits the
 * same CSS; (c) emits none). Run: bun spike/children-scope/measure.ts
 *
 * - Child side: every component whose template inserts `{children}` gains
 *   the foreign-region pseudo-boundary — paid whether or not a compiled
 *   parent composes it (the component cannot know).
 * - Owner side: a component composing a child WITH children gains the
 *   region re-include. The corpus has none yet (LTC026 blocks it, LT-462);
 *   module-codeblock is projected with its two `:global` rules moved back
 *   into the scoped sheet, the composition LT-462 schedules.
 */
import { gzipSync } from 'node:zlib'
import { collectScopeBoundaries } from '../../server/compiler/css-scope'
import { DEFAULT_CSS_TARGETS } from '../../server/compiler/emit-paths'
import { emitChildrenScoped } from '../../server/tests/compiler/children-scope'
import {
	compileCorpusSource,
	loadCorpus,
} from '../../server/tests/compiler/corpus-fixture'

const NATIVE = {
	chrome: 118 << 16,
	edge: 118 << 16,
	firefox: 128 << 16,
	safari: (17 << 16) | (4 << 8),
}
const gz = (s: string) => gzipSync(s).length
const row = (name: string, base: string, a: string) =>
	`| ${name} | ${base.length} → ${a.length} (+${a.length - base.length}) | ${gz(base)} → ${gz(a)} (+${gz(a) - gz(base)}) |`

type IR = any
const corpus: IR[] = []
for (const file of await loadCorpus())
	corpus.push({
		file,
		ir: compileCorpusSource(file.content, file.path).component,
	})
// A stand-in compose registry: component name → tag (ADR 0033 s3 boundaries).
const registry = new Map(
	corpus.filter(c => c.ir).map(c => [c.ir.name, { tag: c.ir.tag }]),
)
const boundariesOf = (ir: IR): string[] =>
	collectScopeBoundaries(ir.root, registry as any)

const lines: string[] = []
const seen = new Set<string>()
for (const { file, ir } of corpus) {
	if (!file.content.includes('{children}')) continue
	if (!ir?.sheetText || seen.has(ir.tag)) continue
	const tag: string = ir.tag
	seen.add(tag)
	for (const [mode, targets] of [
		['native', NATIVE],
		['lowered', DEFAULT_CSS_TARGETS],
	] as const) {
		const emit = (inserts: boolean) =>
			emitChildrenScoped(ir.sheetText, tag, boundariesOf(ir), targets, mode, {
				inserts,
				owns: false,
			})
		lines.push(row(`${tag} (${mode}, inserts)`, emit(false), emit(true)))
	}
}

// Owner side, projected: module-codeblock composing module-scrollarea with
// children, its `:global` pre/code rules moved into the scoped sheet.
const codeblock = corpus.find(c =>
	c.file.path.endsWith('module-codeblock.tsx'),
)!
const authored: string = codeblock.ir.sheetText
const owned = authored
	.replace(/:global\s*\{([\s\S]*)\}\s*$/, '$1')
	.replace(/module-codeblock (pre|code)/g, '$1')
for (const [mode, targets] of [
	['native', NATIVE],
	['lowered', DEFAULT_CSS_TARGETS],
] as const) {
	const b = boundariesOf(codeblock.ir)
	const quo = emitChildrenScoped(
		authored,
		'module-codeblock',
		b,
		targets,
		mode,
		{
			inserts: false,
			owns: false,
		},
	)
	const a = emitChildrenScoped(owned, 'module-codeblock', b, targets, mode, {
		inserts: false,
		owns: true,
	})
	lines.push(row(`module-codeblock (${mode}, owns; projected)`, quo, a))
}
console.log('| component | bytes | gzip |\n|---|---|---|')
console.log(lines.join('\n'))
