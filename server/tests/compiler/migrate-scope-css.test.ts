import { describe, expect, test } from 'bun:test'
import { migrateSheet } from '../../../scripts/migrate-scope-css'

/** One sheet through the codemod, tab-indented as the corpus writes it. */
const migrate = (sheet: string, limits: string[] = []): string =>
	migrateSheet(sheet, limits)

describe('migrate-scope-css (LT-501, ADR 0033 s1)', () => {
	test('the host block keeps declarations and root variants; descendants move out bare', () => {
		expect(
			migrate(
				[
					':host {',
					'\tdisplay: block;',
					'',
					'\t&.wide {',
					'\t\twidth: 100%;',
					'\t}',
					'',
					'\t> label {',
					'\t\tcolor: red;',
					'\t}',
					'',
					'\t& .hint {',
					'\t\tcolor: gray;',
					'\t}',
					'}',
				].join('\n'),
			),
		).toBe(
			[
				'@scope {',
				'\t:where(:scope) {',
				'\t\tdisplay: block;',
				'',
				'\t\t&.wide {',
				'\t\t\twidth: 100%;',
				'\t\t}',
				'\t}',
				'',
				'\t> label {',
				'\t\tcolor: red;',
				'\t}',
				'',
				'\t.hint {',
				'\t\tcolor: gray;',
				'\t}',
				'}',
			].join('\n'),
		)
	})

	test('a state-dependent descendant leads with :where(:scope)X', () => {
		const out = migrate(
			':host {\n\t&[open] > .panel {\n\t\tdisplay: block;\n\t}\n\t&:focus-within {\n\t\t> p {\n\t\t\topacity: 1;\n\t\t}\n\t}\n}',
		)
		expect(out).toContain('\t:where(:scope)[open] > .panel {\n')
		expect(out).toContain('\t:where(:scope):focus-within {\n\t\t> p {\n')
		expect(out).not.toContain(':where(:scope) {')
	})

	test(':host(X) becomes :where(:scope)X; a type or list argument wraps in :is()', () => {
		const out = migrate(
			':host(.compact) .x {\n\ttop: 0;\n}\n\n:host([a], .b) {\n\ttop: 1px;\n}\n\n:host .y {\n\ttop: 2px;\n}',
		)
		expect(out).toContain('\t:where(:scope).compact .x {')
		expect(out).toContain('\t:where(:scope):is([a], .b) {')
		expect(out).toContain('\t.y {')
	})

	test('limits are written as authored; :global unwraps and hoisted at-rules stay on top', () => {
		const out = migrate(
			'@keyframes spin {\n\tto {\n\t\trotate: 1turn;\n\t}\n}\n\n:global(body.lock) {\n\toverflow: hidden;\n}\n\n.x {\n\ttop: 0;\n}',
			['b-x', 'c-y'],
		)
		expect(out).toBe(
			'@keyframes spin {\n\tto {\n\t\trotate: 1turn;\n\t}\n}\n\nbody.lock {\n\toverflow: hidden;\n}\n\n@scope to (b-x > *, c-y > *) {\n\t.x {\n\t\ttop: 0;\n\t}\n}',
		)
	})

	test('a conditional group around :host is rewritten inside the block', () => {
		const out = migrate(
			'@container (width > 27rem) {\n\t:host {\n\t\t& form {\n\t\t\tflex-direction: row;\n\t\t}\n\t}\n}',
		)
		expect(out).toBe(
			'@scope {\n\t@container (width > 27rem) {\n\t\tform {\n\t\t\tflex-direction: row;\n\t\t}\n\t}\n}',
		)
	})

	test('a conditional group mixing root declarations and descendants splits', () => {
		const out = migrate(
			':host {\n\t@media (width > 1px) {\n\t\tgap: 0;\n\t\t> p {\n\t\t\ttop: 0;\n\t\t}\n\t}\n}',
		)
		expect(out).toContain(
			'\t@media (width > 1px) {\n\t\t:where(:scope) {\n\t\t\tgap: 0;\n\t\t}\n\n\t\t> p {',
		)
	})

	test('idempotent: a sheet with a top-level @scope passes through', () => {
		const sheet = '@scope {\n\t:where(:scope) {\n\t\ttop: 0;\n\t}\n}'
		expect(migrate(sheet)).toBe(sheet)
	})
})
