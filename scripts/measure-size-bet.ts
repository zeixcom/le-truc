#!/usr/bin/env bun

/**
 * LT-266 — the size bet, measured.
 *
 * Emits bytes for the SAME application (the module-todo composite and its
 * component split) authored in Le Truc and in React, over the wire,
 * compressed. The payload is reported separately from the runtime, since
 * the runtime amortizes across a page and the payload does not. The React
 * side additionally pays a JSON state payload: its hydration needs the
 * initial items serialized into the page, which Le Truc replaces by
 * harvesting the server-rendered DOM (ADR 0003 — no state ever crosses the
 * server→client boundary).
 *
 * Component split, identical on both sides:
 *   module-todo (composite) → form-textbox, basic-button, basic-pluralize,
 *                             form-checkbox, form-inplace-edit, form-radiogroup
 *
 * Sources (both real, in-repo):
 *   Le Truc — examples/module/todo/module-todo.ts (the component a page
 *   ships today) + the six composed children's compiled corpus clients;
 *   React — spike/size-bet/react/ (same split, same DOM, same behaviors).
 *
 * Everything is bundled like a consumer ships it: minified, production
 * DEV_MODE ("false" — dev instrumentation folded out), browser target.
 * Per-component rows each include their framework slice, so they do NOT
 * sum; the page row (one deduped bundle for the whole component split) is
 * the over-the-wire number, and the runtime floor is what amortizes.
 *
 * Usage: bun scripts/measure-size-bet.ts
 */

import { brotliCompressSync, gzipSync } from 'node:zlib'

/* === Sizes === */

type Sizes = { raw: number; gzip: number; brotli: number }

const measure = (bytes: Uint8Array): Sizes => ({
	raw: bytes.byteLength,
	gzip: gzipSync(bytes, { level: 9 }).byteLength,
	brotli: brotliCompressSync(bytes, {
		params: { [0x06]: 11 }, // BROTLI_PARAM_QUALITY
	}).byteLength,
})

const build = async (entrypoint: string): Promise<Sizes> => {
	const result = await Bun.build({
		entrypoints: [entrypoint],
		target: 'browser',
		minify: true,
		// String defines, matching build:prod — Bun folds the string
		// comparison `"false" === 'true'` at each DEV guard site (see
		// test/regression-bundle.test.ts for the precedent). NODE_ENV must
		// also be pinned: a browser-target build defaults it to
		// "development", which would silently ship React's dev bundle.
		define: {
			'process.env.DEV_MODE': '"false"',
			'process.env.NODE_ENV': '"production"',
		},
	})
	if (!result.success) {
		throw new Error(`build failed for ${entrypoint}: ${result.logs}`)
	}
	return measure(new Uint8Array(await result.outputs[0]!.arrayBuffer()))
}

/* === The component split, per side === */

const GENERATED = 'server/generated/components'

const leTrucComponents: Array<[string, string]> = [
	['module-todo (composite, hand-authored)', 'examples/module/todo/module-todo.ts'],
	['form-textbox', `${GENERATED}/form-textbox.client.ts`],
	['basic-button', `${GENERATED}/basic-button.client.ts`],
	['basic-pluralize', `${GENERATED}/basic-pluralize.client.ts`],
	['form-checkbox', `${GENERATED}/form-checkbox.client.ts`],
	['form-inplace-edit', `${GENERATED}/form-inplace-edit.client.ts`],
	['form-radiogroup', `${GENERATED}/form-radiogroup.client.ts`],
]

const reactComponents: Array<[string, string]> = [
	['module-todo (composite)', 'spike/size-bet/react/module-todo.tsx'],
	['form-textbox', 'spike/size-bet/react/components/form-textbox.tsx'],
	['basic-button', 'spike/size-bet/react/components/basic-button.tsx'],
	['basic-pluralize', 'spike/size-bet/react/components/basic-pluralize.tsx'],
	['form-checkbox', 'spike/size-bet/react/components/form-checkbox.tsx'],
	['form-inplace-edit', 'spike/size-bet/react/components/form-inplace-edit.tsx'],
	['form-radiogroup', 'spike/size-bet/react/components/form-radiogroup.tsx'],
]

/* === Measure === */

const rows: Array<{
	side: string
	artifact: string
	raw: number
	gzip: number
	brotli: number
}> = []

const add = async (
	side: string,
	artifact: string,
	entrypoint: string,
): Promise<void> => {
	const sizes = await build(entrypoint)
	rows.push({ side, artifact, ...sizes })
}

console.log('⏳ Building Le Truc side (production bundles)…')
await add('Le Truc', 'runtime floor (minimal component entry)', 'test/fixtures/minimal-entry.ts')
for (const [name, path] of leTrucComponents) await add('Le Truc', name, path)
await add('Le Truc', 'PAGE: module-todo + 6 children, one bundle', 'spike/size-bet/le-truc/page.ts')

console.log('⏳ Building React side (production bundles)…')
await add('React', 'runtime floor (hydrateRoot only)', 'spike/size-bet/react/runtime.ts')
for (const [name, path] of reactComponents) await add('React', name, path)
await add('React', 'PAGE: module-todo + 6 children, one bundle', 'spike/size-bet/react/client.tsx')

// The JSON state payload the React page must embed for hydration. Le Truc
// ships none — the DOM is the state (ADR 0003). The render runs as a
// subprocess on purpose: the React fixture tree type-checks under its own
// tsconfig (React's JSX table, not Le Truc's), and the root program must
// not absorb it.
const rendered = Bun.spawnSync(['bun', 'spike/size-bet/react/render.ts'])
if (rendered.exitCode !== 0) {
	throw new Error(`react render failed: ${rendered.stderr.toString()}`)
}
const { html, json, seed } = JSON.parse(rendered.stdout.toString()) as {
	html: string
	json: string
	seed: Array<{ id: string; label: string }>
}
const jsonSizes = measure(new TextEncoder().encode(json))
rows.push({
	side: 'React',
	artifact: 'state payload (JSON seed, 5 items); Le Truc: none',
	...jsonSizes,
})

// The served markup both ways, seeded with the same items: Le Truc carries
// the items as authored DOM (page-authored per the data account), React as
// SSR markup PLUS the JSON script above.
const leTrucHtml = await leTrucSeededHtml()
rows.push({ side: 'Le Truc', artifact: 'HTML (seeded page markup)', ...leTrucHtml })
rows.push({ side: 'React', artifact: 'HTML (SSR + JSON payload script)', ...measure(new TextEncoder().encode(html)) })

/* === Report === */

const fmt = (n: number): string => `${(n / 1024).toFixed(2)} kB`
const pad = (s: string, n: number): string => (s + ' '.repeat(n)).slice(0, n)

console.log(`\n📏 LT-266 size bet — module-todo application, over the wire

Per-component rows include their framework slice and do NOT sum.
"PAGE" is the single deduped bundle a page ships for the split.
The runtime floor amortizes once per page; payloads do not amortize.

${pad('side', 9)}${pad('artifact', 52)}${pad('raw', 10)}${pad('gzip', 10)}brotli`)
console.log('-'.repeat(91))
for (const row of rows) {
	console.log(
		`${pad(row.side, 9)}${pad(row.artifact, 52)}${pad(fmt(row.raw), 10)}${pad(fmt(row.gzip), 10)}${fmt(row.brotli)}`,
	)
}
const page = (side: string) => rows.find(row => row.side === side && row.artifact.startsWith('PAGE'))!
const floor = (side: string) =>
	rows.find(
		row =>
			row.side === side &&
			row.artifact.startsWith('runtime floor'),
	)!
console.log('-'.repeat(91))
for (const side of ['Le Truc', 'React'] as const) {
	const p = page(side)
	const f = floor(side)
	console.log(
		`${pad(side, 9)}${pad('derived: page minus runtime floor (the payload)', 52)}${pad(fmt(p.raw - f.raw), 10)}${pad(fmt(p.gzip - f.gzip), 10)}${fmt(p.brotli - f.brotli)}`,
	)
}
console.log('-'.repeat(91))
// The number the bet is judged on: everything over the wire for the seeded
// page — markup, the one JS bundle, and (React only) the JSON state payload.
for (const side of ['Le Truc', 'React'] as const) {
	const total = rows
		.filter(
			row =>
				row.side === side &&
				(row.artifact.startsWith('PAGE') ||
					row.artifact.startsWith('HTML') ||
					row.artifact.startsWith('state payload')),
		)
		.reduce(
			(acc, row) => ({
				raw: acc.raw + row.raw,
				gzip: acc.gzip + row.gzip,
				brotli: acc.brotli + row.brotli,
			}),
			{ raw: 0, gzip: 0, brotli: 0 },
		)
	console.log(
		`${pad(side, 9)}${pad('TOTAL over the wire (HTML + JS + JSON state)', 52)}${pad(fmt(total.raw), 10)}${pad(fmt(total.gzip), 10)}${fmt(total.brotli)}`,
	)
}
console.log(
	`\nReact's JSON state payload scales with the list: ${jsonSizes.raw} B raw / ${jsonSizes.gzip} B gzip for the 5 seeded items, shipped on EVERY visit; Le Truc's state channel is the already-shipped DOM.`,
)

/**
 * The seeded Le Truc page markup: the authored fixture with the five items
 * filled into the container from its own `<template>` — the data-account
 * way to instantiate a component with initial state (the page authors the
 * markup, the component harvests it). No JSON, no extra script.
 */
async function leTrucSeededHtml(): Promise<Sizes> {
	const fixture = await Bun.file('examples/module/todo/module-todo.html').text()
	const template = fixture.match(/<template>([\s\S]*?)<\/template>/)?.[1] ?? ''
	const items = seed
		.map(todo =>
			template
				.replace(/<slot>[\s\S]*?<\/slot>/, escapeHtml(todo.label))
				.replace('<li>', `<li data-key="${todo.id}">`),
		)
		.join('\n')
	const page = fixture.replace(/<ol data-container><\/ol>/, `<ol data-container>\n${items}\n</ol>`)
	return measure(new TextEncoder().encode(page))
}

function escapeHtml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
}
