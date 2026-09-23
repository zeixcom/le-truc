/**
 * Unit + integration tests for the document-level page renderer
 * (server/effects/page-render.ts, LT-194).
 *
 * Units run on a synthetic registry and injected modules (the
 * `resolveModule` seam — no generated dir needed). The integration block
 * compiles the REAL corpus into an isolated generated dir (the
 * `compileCorpus` + `createGeneratedDir` pattern) and renders the real
 * authored demo markup — pinning the LT-191 acceptance fixture (the
 * `<div lang="cy">` wrapper instance) at its served home.
 */

import { afterAll, describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import type { ComponentRegistry, RegistryEntry } from '../../compiler/registry'
import { compileCorpus } from '../../corpus-compile'
import {
	type PageRenderModule,
	renderPageOccurrences,
} from '../../effects/page-render'
import { loadCorpus } from '../compiler/corpus-fixture'
import { createGeneratedDir } from '../helpers/generated-corpus'

/* === Fixtures === */

const entry = (over: Partial<RegistryEntry>): RegistryEntry =>
	({
		tag: 'x-el',
		name: 'XEl',
		tier: 'folded',
		source: 'examples/x/x-el.tsrx',
		composesTags: [],
		suppressedSites: [],
		routingSignals: [],
		declaresI18n: true,
		langArgDefault: null,
		...over,
	}) as RegistryEntry

const registryOf = (...entries: RegistryEntry[]): ComponentRegistry =>
	Object.fromEntries(entries.map(e => [e.tag, e]))

/** A fake generated module: captures the args the renderer assembles. */
const fakeModule = (tag: string, rendered: string): PageRenderModule => ({
	argsFromAttrs: (attrs: Record<string, string | null>) => {
		const args: Record<string, unknown> = {}
		for (const [k, v] of Object.entries(attrs)) if (v !== null) args[k] = v
		return Object.keys(args).length > 0 ? args : null
	},
	i18nRecord: (t: string, lang?: string) => ({ t, lang }),
	[`render${tag.replace(/(^|-)([a-z])/g, (_, __, c: string) => c.toUpperCase())}`]:
		() => rendered,
})

/* === Resolution precedence (ADR 0030 sub-design 3) === */

describe('locale resolution', () => {
	test('the own lang attribute wins over a positional ancestor', async () => {
		const result = await renderPageOccurrences(
			'<div lang="cy"><x-el lang="de" count="1">authored</x-el></div>',
			{
				registry: registryOf(entry({ tag: 'x-el' })),
				pageLocale: 'en',
				resolveModule: async tag => fakeModule(tag, 'R'),
			},
		)
		expect(result.rendered).toEqual([{ tag: 'x-el', locale: 'de' }])
	})

	test('the nearest positional [lang] ancestor wins over the page locale', async () => {
		const result = await renderPageOccurrences(
			'<div lang="cy"><section lang="ar"><x-el count="1">a</x-el></section></div>',
			{
				registry: registryOf(entry({ tag: 'x-el' })),
				pageLocale: 'en',
				resolveModule: async tag => fakeModule(tag, 'R'),
			},
		)
		expect(result.rendered[0]?.locale).toBe('ar')
	})

	test('a baseless occurrence falls back to the page locale', async () => {
		const result = await renderPageOccurrences(
			'<p><x-el count="1">a</x-el></p>',
			{
				registry: registryOf(entry({ tag: 'x-el' })),
				pageLocale: 'de',
				resolveModule: async tag => fakeModule(tag, 'R'),
			},
		)
		expect(result.rendered[0]?.locale).toBe('de')
	})

	test('a baseless occurrence in a single-copy tree stays authored', async () => {
		const html = '<p><x-el count="1">a</x-el></p>'
		const result = await renderPageOccurrences(html, {
			registry: registryOf(entry({ tag: 'x-el' })),
			pageLocale: null,
			resolveModule: async tag => fakeModule(tag, 'R'),
		})
		expect(result.html).toBe(html)
		expect(result.rendered).toEqual([])
		expect(result.skipped).toEqual([
			{ tag: 'x-el', reason: 'no-resolvable-locale' },
		])
	})

	test('an empty lang attribute is not a locale', async () => {
		const result = await renderPageOccurrences(
			'<div lang=""><x-el count="1">a</x-el></div>',
			{
				registry: registryOf(entry({ tag: 'x-el' })),
				pageLocale: 'en',
				resolveModule: async tag => fakeModule(tag, 'R'),
			},
		)
		expect(result.rendered[0]?.locale).toBe('en')
	})
})

/* === Qualification === */

describe('qualification', () => {
	test('a simulated-tier component stays authored (the realm cannot run per rebuild)', async () => {
		const html = '<div lang="cy"><x-el count="1">a</x-el></div>'
		const result = await renderPageOccurrences(html, {
			registry: registryOf(entry({ tag: 'x-el', tier: 'simulated' })),
			pageLocale: null,
			resolveModule: async tag => fakeModule(tag, 'R'),
		})
		expect(result.html).toBe(html)
		expect(result.rendered).toEqual([])
	})

	test('a component without declaresI18n stays authored even with a lang arg', async () => {
		const html = '<div lang="cy"><x-el count="1">a</x-el></div>'
		const result = await renderPageOccurrences(html, {
			registry: registryOf(
				entry({ tag: 'x-el', declaresI18n: false, langArgDefault: 'en' }),
			),
			pageLocale: null,
			resolveModule: async tag => fakeModule(tag, 'R'),
		})
		expect(result.html).toBe(html)
	})

	test('a module without argsFromAttrs is skipped, not rendered', async () => {
		const html = '<div lang="cy"><x-el count="1">a</x-el></div>'
		const result = await renderPageOccurrences(html, {
			registry: registryOf(entry({ tag: 'x-el' })),
			pageLocale: null,
			resolveModule: async () => ({ renderXEl: () => 'R' }),
		})
		expect(result.html).toBe(html)
		expect(result.skipped).toEqual([
			{ tag: 'x-el', reason: 'no-module-export' },
		])
	})

	test('unrenderable args (required arg missing from attributes) stay authored', async () => {
		const html = '<div lang="cy"><x-el>a</x-el></div>'
		const result = await renderPageOccurrences(html, {
			registry: registryOf(entry({ tag: 'x-el' })),
			pageLocale: null,
			resolveModule: async () => ({
				argsFromAttrs: () => null,
				renderXEl: () => 'R',
			}),
		})
		expect(result.html).toBe(html)
		expect(result.skipped).toEqual([
			{ tag: 'x-el', reason: 'unrenderable-args' },
		])
	})
})

/* === Byte discipline and splicing === */

describe('byte discipline', () => {
	test('bytes outside the occurrence survive verbatim; multiple occurrences splice', async () => {
		const result = await renderPageOccurrences(
			'<p>before</p>\n<div lang="cy"><x-el count="1">one</x-el></div>\n<div lang="de"><x-el count="2">two</x-el></div>\n<p>after</p>',
			{
				registry: registryOf(entry({ tag: 'x-el' })),
				pageLocale: null,
				resolveModule: async tag =>
					fakeModule(tag, `<${tag} rendered></${tag}>`),
			},
		)
		expect(result.html).toBe(
			'<p>before</p>\n<div lang="cy"><x-el rendered></x-el></div>\n<div lang="de"><x-el rendered></x-el></div>\n<p>after</p>',
		)
	})

	test('escaped occurrences in code fences are untouched', async () => {
		const html = '<pre><code>&lt;x-el count="1"&gt;</code></pre>'
		const result = await renderPageOccurrences(html, {
			registry: registryOf(entry({ tag: 'x-el' })),
			pageLocale: 'en',
			resolveModule: async tag => fakeModule(tag, 'R'),
		})
		expect(result.html).toBe(html)
		expect(result.rendered).toEqual([])
	})

	test('class and id splice onto the rendered root, class merging', async () => {
		const result = await renderPageOccurrences(
			'<div lang="cy"><x-el class="mine" id="the-id" count="1">a</x-el></div>',
			{
				registry: registryOf(entry({ tag: 'x-el' })),
				pageLocale: null,
				resolveModule: async tag =>
					fakeModule(tag, '<x-el count="1" class="own"></x-el>'),
			},
		)
		expect(result.html).toContain('class="own mine"')
		expect(result.html).toContain('id="the-id"')
	})

	test('class and id never ride the forwarded args (LT-090: they address the host)', async () => {
		// A component like form-textbox has an `id = name` string arg; the
		// review found the renderer letting the occurrence's id through BOTH
		// channels. Pinned: the host splice happens, the arg does not — a
		// compose site filters them from the child's args the same way, so
		// internal wiring derives from `name` in both renders alike.
		const seenAttrs: Record<string, string | null>[] = []
		const result = await renderPageOccurrences(
			'<div lang="cy"><x-el class="mine" id="the-id" name="email" count="1">a</x-el></div>',
			{
				registry: registryOf(entry({ tag: 'x-el' })),
				pageLocale: null,
				resolveModule: async tag => ({
					argsFromAttrs: (attrs: Record<string, string | null>) => {
						seenAttrs.push(attrs)
						return { ...attrs }
					},
					i18nRecord: (t: string, lang?: string) => ({ t, lang }),
					renderXEl: () => '<x-el></x-el>',
				}),
			},
		)
		expect(result.html).toContain('id="the-id"')
		expect(result.html).toContain('class="mine"')
		expect(Object.keys(seenAttrs[0] ?? {})).toEqual(['name', 'count'])
	})
})

/* === The renderer-supplied lang and i18n record === */

describe('renderer-supplied args', () => {
	test('lang rides the resolved locale and i18n the record at it', async () => {
		const seen: Record<string, unknown>[] = []
		const result = await renderPageOccurrences(
			'<div lang="cy"><x-el count="1">a</x-el></div>',
			{
				registry: registryOf(entry({ tag: 'x-el', langArgDefault: 'en' })),
				pageLocale: null,
				resolveModule: async tag => {
					if (tag === 'i18n')
						return {
							i18nRecord: (t: string, lang?: string) => ({ t, lang }),
						}
					return {
						argsFromAttrs: (attrs: Record<string, string | null>) => ({
							count: attrs['count'],
						}),
						renderXEl: (args: Record<string, unknown>) => {
							seen.push(args)
							return '<x-el></x-el>'
						},
					}
				},
			},
		)
		expect(result.rendered).toHaveLength(1)
		expect(seen[0]?.['lang']).toBe('cy')
		expect(seen[0]?.['i18n']).toEqual({ t: 'x-el', lang: 'cy' })
	})

	test('no lang arg is injected when the component takes none', async () => {
		const seen: Record<string, unknown>[] = []
		await renderPageOccurrences(
			'<div lang="cy"><x-el count="1">a</x-el></div>',
			{
				registry: registryOf(entry({ tag: 'x-el', langArgDefault: null })),
				pageLocale: null,
				resolveModule: async tag => {
					if (tag === 'i18n')
						return {
							i18nRecord: (t: string, lang?: string) => ({ t, lang }),
						}
					return {
						argsFromAttrs: () => ({}),
						renderXEl: (args: Record<string, unknown>) => {
							seen.push(args)
							return '<x-el></x-el>'
						},
					}
				},
			},
		)
		expect(seen[0]).not.toHaveProperty('lang')
		expect(seen[0]?.['i18n']).toEqual({ t: 'x-el', lang: 'cy' })
	})
})

/* === Integration: the real corpus, the LT-191 fixture at its home === */

const ROOT = path.resolve(import.meta.dir, '../../..')
const corpusMarkup = (rel: string) => Bun.file(path.join(ROOT, rel))

const generated = createGeneratedDir('page-render')
afterAll(() => generated.cleanup())

describe('the real corpus (integration)', () => {
	const compiled = loadCorpus().then(files =>
		compileCorpus(files, generated.path),
	)

	test('the LT-191 fixture: the <div lang="cy"> wrapper instance server-renders', async () => {
		await compiled
		const markup = await corpusMarkup(
			'examples/basic/pluralize/basic-pluralize.html',
		).text()
		const result = await renderPageOccurrences(markup, {
			generatedDir: generated.path,
			pageLocale: null,
		})
		// Seven locale-explicit instances render; the five baseless en
		// instances stay authored in this single-copy tree.
		const locales = result.rendered.map(r => r.locale)
		expect(locales).toContain('cy')
		expect(locales).toContain('de')
		expect(
			result.skipped.every(s => s.reason === 'no-resolvable-locale'),
		).toBeTrue()

		// The ancestor-inheritance instance materializes its walked locale
		// onto the served root — the completion signal LT-191's fixture had
		// no home for — and the count=2 Welsh render shows the `two` form
		// from the committed cy catalog (dasg), every other category hidden.
		const at = result.html.indexOf('welsh-ancestor-test')
		expect(at).toBeGreaterThan(-1)
		const instance = result.html.slice(at - 120, at + 500)
		expect(instance).toContain('<basic-pluralize count="2" lang="cy"')
		expect(instance).toContain('<span class="two">dasg</span>')
		expect(instance).toContain('<span hidden class="other">tasgiau</span>')
		expect(instance).toContain('Wedi cwblhau pob tasg!')
	})

	test('LT-290: no argsFromAttrs helper names a render-scope stub', async () => {
		await compiled
		const glob = new Bun.Glob('*.server.ts')
		let helpers = 0
		for await (const file of glob.scan(generated.path)) {
			const code = await Bun.file(path.join(generated.path, file)).text()
			const helper = code.match(
				/^export function argsFromAttrs[\s\S]*?^\}/m,
			)?.[0]
			if (!helper) continue
			helpers++
			const stubs = [...code.matchAll(/const (\w+): any = refStub/g)].map(
				m => m[1] as string,
			)
			for (const stub of stubs)
				expect(helper).not.toMatch(new RegExp(`\\b${stub}\\b`))
		}
		expect(helpers).toBeGreaterThan(0)
	})

	test('LT-290: a spinbutton occurrence whose fallback reads a ref stays authored, without throwing', async () => {
		await compiled
		const markup =
			'<form-spinbutton lang="en" name="qty" value="5"><input type="number"></form-spinbutton>'
		const result = await renderPageOccurrences(markup, {
			generatedDir: generated.path,
			pageLocale: null,
		})
		expect(result.html).toBe(markup)
		expect(result.rendered).toEqual([])
		expect(result.skipped).toEqual([
			{ tag: 'form-spinbutton', reason: 'unrenderable-args' },
		])
	})

	test('a lang-arg component without i18n stays authored (basic-number)', async () => {
		await compiled
		const markup = await corpusMarkup(
			'examples/basic/number/basic-number.html',
		).text()
		const result = await renderPageOccurrences(markup, {
			generatedDir: generated.path,
			pageLocale: null,
		})
		expect(result.html).toBe(markup)
		expect(result.rendered).toEqual([])
	})
})
