/**
 * Phase 0 probe 3: unified-format syntax feasibility.
 *
 * The unified format extends TSRX with Le Truc-reactive positions the grammar
 * may or may not accept in 0.1.60. Each position is tested in isolation with
 * the user's sketched form first, then plausible fallbacks.
 */
import { parseModule } from '@tsrx/core'

const cases: Array<[string, string]> = [
	['child &{expr}', 'function A() @{ <p>&{x}</p> }'],
	['child {&expr}', 'function A() @{ <p>{& x}</p> }'],
	['child thunk &{() => …}', 'function A() @{ <p>&{() => x * 2}</p> }'],
	['child string-key &{"prop"}', `function A() @{ <p>&{'count'}</p> }`],
	['attr bare class=&{a: b}', 'function A() @{ <p class=&{a: b}>ok</p> }'],
	['attr braced class={&{a: b}}', 'function A() @{ <p class={&{a: b}}>ok</p> }'],
	['attr bare value=&{expr}', 'function A() @{ <x-el value=&{y}>ok</x-el> }'],
	['attr braced value={& expr}', 'function A() @{ <x-el value={& y}>ok</x-el> }'],
	['attr boolean bare hidden=&{cond}', 'function A() @{ <p hidden=&{c}>ok</p> }'],
	['event onClick', 'function A() @{ <button onClick={f}>ok</button> }'],
	['event on:click', 'function A() @{ <button on:click={f}>ok</button> }'],
	['event lowercase onclick', 'function A() @{ <button onclick={f}>ok</button> }'],
	['ref #name', 'function A() @{ <input #tb> }'],
	['ref attr ref={name}', 'function A() @{ <input ref={tb}> }'],
	['@for no clauses', 'function A() @{ <ul>@for (const x of xs) { <li>{x}</li> }</ul> }'],
	['@for key k', 'function A() @{ <ul>@for (const x of xs; key k) { <li>{x}</li> }</ul> }'],
	['@for key x.id', 'function A() @{ <ul>@for (const x of xs; key x.id) { <li>{x}</li> }</ul> }'],
	['@for index i', 'function A() @{ <ul>@for (const x of xs; index i) { <li>{x}</li> }</ul> }'],
	['setup statements + expose', 'function A() @{ const s = f(); expose({ c: s.g }); <p>ok</p> }'],
	['param lazy destructure &{ }', 'function A(&{ count }) @{ <p>&{count}</p> }'],
]

console.log('=== isolated position tests ===')
for (const [label, src] of cases) {
	try {
		parseModule(src, 'case.tsrx')
		console.log(`✅ ${label}`)
	} catch (e) {
		console.log(`❌ ${label} — ${(e as Error).message?.slice(0, 120)}`)
	}
}

console.log('\n=== unified spike sources ===')
import * as fs from 'node:fs'
import * as path from 'node:path'
const dir = path.resolve(import.meta.dir, 'unified')
for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.tsrx'))) {
	const source = fs.readFileSync(path.join(dir, file), 'utf8')
	try {
		parseModule(source, file)
		console.log(`✅ ${file} parses`)
	} catch (e) {
		const msg = (e as Error).message ?? ''
		const loc = msg.match(/\((\d+):(\d+)\)/)
		let line = ''
		if (loc) {
			const n = parseInt(loc[1]!, 10)
			line = source.split('\n')[n - 1]?.trim().slice(0, 90) ?? ''
		}
		console.log(`❌ ${file} — ${msg.slice(0, 140)}\n     line ${loc?.[1] ?? '?'}: ${line}`)
	}
}
