/**
 * LT-514: BasicButton's visible label takes BOTH channels — non-interactive
 * `children` for rich static content (an icon plus text), and the reactive
 * `label` prop for runtime writes (module-ticker `pass()`es it).
 *
 * Server half: children render TRUSTED into `span.label` (String(children),
 * ADR 0048 s1 — the card-callout semantics), the `label` arg escaped through
 * the text sink. A page render carries no `data-children` marker; the
 * composed form is pinned by server.golden.test.ts's module-list case.
 *
 * Client half (the regression pin for the guarded watch): rich children
 * SURVIVE connect — the connect run's value IS the span's own text, and the
 * equality guard keeps that run from flattening the markup — while a
 * runtime `label` write has a different value and replaces the rich
 * content with that text.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { pathToFileURL } from 'node:url'
import {
	collectCorpusSources,
	loadCorpusConfig,
} from '../../compiler/corpus-scan'
import type { InternalComponentRegistry } from '../../compiler/registry'
import {
	createSimulationRealm,
	type JsdomSimulationRealm,
} from '../../compiler/sim/realm'
import { compileCorpus } from '../../corpus-compile'
import { createGeneratedDir } from '../helpers/generated-corpus'

const generated = createGeneratedDir('label-children')
afterAll(() => generated.cleanup())

const config = loadCorpusConfig()
const buttonFile = (await collectCorpusSources(config)).find(file =>
	file.filename.endsWith('/basic-button.tsrx'),
)
if (!buttonFile) throw new Error('basic-button.tsrx not found')

const compiled = await compileCorpus([buttonFile], generated.path)
const registry = JSON.parse(
	await Bun.file(`${generated.path}/registry.internal.json`).text(),
) as InternalComponentRegistry
const info = compiled.find(entry => entry.tag === 'basic-button')
if (!info) throw new Error('basic-button did not compile')

const serverMarkup = async (args: Record<string, unknown>): Promise<string> => {
	const mod = (await import(
		pathToFileURL(info.serverModulePath).href
	)) as Record<string, (args: Record<string, unknown>) => string>
	const renderFn = mod.renderBasicButton
	if (!renderFn) throw new Error('renderBasicButton missing')
	return renderFn(args)
}

const realm: JsdomSimulationRealm = createSimulationRealm({
	composesTags: tag => registry[tag]?.composesTags ?? [],
	suppressedSites: tag => registry[tag]?.suppressedSites ?? [],
})
await realm.load(() => import(pathToFileURL(info.clientModulePath).href))

describe('basic-button — the label takes children beside the reactive prop (LT-514)', () => {
	test('rich children render trusted into span.label', async () => {
		const html = await serverMarkup({
			children: '<b class="icon">★</b> Save',
		})
		expect(html).toBe(
			'<basic-button><button type="button">' +
				'<span class="label"><b class="icon">★</b> Save</span>' +
				'<span class="badge"></span>' +
				'</button></basic-button>',
		)
	})

	test('the label arg escapes through the text sink when no children are passed', async () => {
		const html = await serverMarkup({ label: 'A & B' })
		expect(html).toContain('<span class="label">A &amp; B</span>')
	})

	test('rich children survive connect; a runtime label write replaces them', async () => {
		const { html } = await realm.render({
			markup: await serverMarkup({
				children: '<b class="icon">★</b> Save',
			}),
			component: 'basic-button',
		})
		// The connect run's harvested label IS the span's own text — the
		// equality guard keeps that run off, so the markup is intact after
		// the driver's post-connect serialization.
		expect(html).toContain(
			'<span class="label"><b class="icon">★</b> Save</span>',
		)

		const host = realm.document.querySelector('basic-button') as unknown as {
			label: string
		}
		if (!host) throw new Error('rendered basic-button not found')
		host.label = 'Saved'
		await new Promise(resolve => setTimeout(resolve, 0))
		const span = realm.document.querySelector('basic-button span.label')
		expect(span?.outerHTML).toBe('<span class="label">Saved</span>')
	})

	test('a plain label still updates through the runtime write', async () => {
		await realm.render({
			markup: await serverMarkup({ label: 'Add' }),
			component: 'basic-button',
		})
		const host = realm.document.querySelector('basic-button') as unknown as {
			label: string
		}
		if (!host) throw new Error('rendered basic-button not found')
		host.label = 'Remove'
		await new Promise(resolve => setTimeout(resolve, 0))
		const span = realm.document.querySelector('basic-button span.label')
		expect(span?.textContent).toBe('Remove')
	})
})
