/**
 * LT-465: emit the probe's stylesheets through the real `emitScopedSheet`
 * (status quo) and the spike prototype (shape a/b), both modes.
 * Run: bun spike/children-scope/generate.ts
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_CSS_TARGETS } from '../../server/compiler/emit-paths'
import { emitChildrenScoped } from '../../server/tests/compiler/children-scope'
import {
	B_SHEET,
	C_SHEET,
	html,
	P_BOUNDARIES,
	P_GLOBAL,
	P_SHEET,
	PAGE,
} from './sheets'

const NATIVE = {
	chrome: 118 << 16,
	edge: 118 << 16,
	firefox: 128 << 16,
	safari: (17 << 16) | (4 << 8),
}
const NONE = { inserts: false, owns: false }

const variants: Array<{ name: string; css: string; html: string }> = []
for (const mode of ['native', 'lowered'] as const) {
	const targets = mode === 'native' ? NATIVE : DEFAULT_CSS_TARGETS
	const emit = (
		sheet: string,
		tag: string,
		b: string[],
		scope = NONE,
	): string => emitChildrenScoped(sheet, tag, b, targets, mode, scope)
	const leaves = emit(B_SHEET, 'b-btn', [])
	// Status quo (ADR 0033 as shipped) and shape (c): no marker, no change.
	variants.push({
		name: `${mode} status-quo`,
		css: [
			emit(P_SHEET, 'p-par', P_BOUNDARIES),
			emit(C_SHEET, 'c-child', []),
			leaves,
		].join('\n'),
		html: html(false, false),
	})
	variants.push({
		name: `${mode} (c) :global`,
		css: [
			emit(`${P_SHEET}\n${P_GLOBAL}`, 'p-par', P_BOUNDARIES),
			emit(C_SHEET, 'c-child', []),
			leaves,
		].join('\n'),
		html: html(false, false),
	})
	const shapeA = [
		emit(P_SHEET, 'p-par', P_BOUNDARIES, { inserts: false, owns: true }),
		emit(C_SHEET, 'c-child', [], { inserts: true, owns: false }),
		leaves,
	].join('\n')
	variants.push({
		name: `${mode} (a) marker`,
		css: shapeA,
		html: html(true, false),
	})
	variants.push({
		name: `${mode} (b) wrapper`,
		css: shapeA,
		html: html(true, true),
	})
}
writeFileSync(
	join(import.meta.dir, 'fixtures.json'),
	`${JSON.stringify({ page: PAGE, variants }, null, '\t')}\n`,
)
console.log(`${variants.length} variants written`)
