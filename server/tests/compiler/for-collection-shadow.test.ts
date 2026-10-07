/**
 * A host-level server-data loop lowers client-side to `const items = all(…)`,
 * so the collection name shadows the server arg of the same name (LT-136).
 * The shadow never reaches tsc: a client position reading the arg is
 * LTC005's server-only-name face, on both surfaces, naming the arg. No
 * dedicated diagnostic is needed.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'

const tsxOf = (read: string) => `export function CList(
	{ items }: { items: string[] },
	{ expose, host, on }: any,
) {
	${read}
	return (
		<c-list>
			{items.map(item => <span class={() => (host.n > 1 ? 'on' : null)}>{item}</span>)}
			<style>{\`:host { display: block; }\`}</style>
		</c-list>
	)
}`

const tsrxOf = (
	read: string,
) => `export function CList({ items }: { items: string[] })
@{
	${read}
	<c-list>
		@for (const item of items) {
			<span class={() => ({ on: host.n > 1 })}>{item}</span>
		}
		<style>:host { display: block; }</style>
	</c-list>
}`

const reads: Record<string, [string, string]> = {
	'an expose() entry': [
		'expose({ n: () => items.length })',
		'server-only name `items`',
	],
	// A setup `on()` whose body reads a server name is not a client-only
	// side effect over `host`: refused at the statement, still LTC005.
	'a setup handler': [
		"on(host, 'click', () => { host.n = items.length })",
		'outside the supported subset',
	],
}

describe('@for collection name vs. server arg of the same name (LT-136)', () => {
	for (const [what, [read, wording]] of Object.entries(reads)) {
		test(`${what} reading the arg is LTC005 naming it — tsx`, () => {
			const { component, diagnostics } = compileComponentTsx(
				tsxOf(read),
				'examples/x/c-list.tsx',
				new Set(),
			)
			expect(component).toBeNull()
			const d = diagnostics.find(x => x.code === 'LTC005')
			expect(d?.message).toContain(wording)
		})

		test(`${what} reading the arg is LTC005 naming it — tsrx`, () => {
			const { component, diagnostics } = compileComponent(
				tsrxOf(read),
				'examples/x/c-list.tsrx',
				new Set(),
			)
			expect(component).toBeNull()
			const d = diagnostics.find(x => x.code === 'LTC005')
			expect(d?.message).toContain(wording)
		})
	}
})
