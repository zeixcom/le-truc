import { existsSync, readFileSync } from 'node:fs'
import Markdoc, { type Node, type Schema, Tag } from '@markdoc/markdoc'
import { ROOT } from '../config'
import { getFilePath } from '../io'

/**
 * Reads the custom-elements-manifest (custom-elements.json) at build time and
 * renders every custom-element declaration as a collapsible card with a
 * member/attribute/CSS-API tabgroup — a static, server-rendered catalog of
 * every example component in the repo. See ADR-0013 and the
 * @zeix/cem-plugin-le-truc plugin for how the manifest itself gets its
 * PascalCase names and inferred members/attributes (including from
 * `ComponentExtension`s like `formAssociated()`).
 *
 * Known limitation: the manifest is read synchronously at transform time,
 * outside the reactive file-signal graph the rest of the docs pipeline uses
 * (see file-signals.ts). A `bun run build:cem` after editing an example's
 * JSDoc regenerates custom-elements.json, but the dev server won't notice
 * that change on its own — touch this page's .md (or restart the dev
 * server) to pick up fresh manifest content while iterating.
 */

/* === Types === */

type CemType = { text?: string }

type CemParameter = {
	name: string
	type?: CemType
	optional?: boolean
}

type CemMember = {
	kind: string
	name: string
	type?: CemType
	description?: string
	parameters?: CemParameter[]
	return?: { type?: CemType }
}

type CemAttribute = {
	name: string
	fieldName?: string
	type?: CemType
	default?: string
	description?: string
}

type CemNamedItem = {
	name: string
	description?: string
}

type CemDeclaration = {
	customElement?: boolean
	tagName?: string
	name?: string
	description?: string
	members?: CemMember[]
	attributes?: CemAttribute[]
	cssProperties?: CemNamedItem[]
	cssParts?: CemNamedItem[]
	slots?: CemNamedItem[]
}

type CemModule = {
	path: string
	declarations?: CemDeclaration[]
}

type CemManifest = {
	modules?: CemModule[]
}

/* === Markdown Helper === */

/**
 * Renders a manifest description (plain JSDoc comment text, which authors
 * write with markdown — backticks for `code`, etc.) through Markdoc's inline
 * parser so it comes out as real `<code>`/`<strong>`/... tags instead of
 * literal backticks. No custom tags are needed for this (descriptions are
 * plain prose, never `{% ... %}`), so a bare `Markdoc.transform(ast)` with no
 * config is enough — avoids importing the full markdocConfig (which imports
 * this very schema, and would be circular).
 */
const parseDescription = (text: string): (string | Tag)[] => {
	if (!text) return []
	const ast = Markdoc.parse(text)
	const transformed = Markdoc.transform(ast)
	const paragraphs = Array.isArray(transformed) ? transformed : [transformed]

	const inline: (string | Tag)[] = []
	for (const node of paragraphs) {
		if (!(node instanceof Tag) || node.name !== 'article') continue
		for (const child of node.children ?? []) {
			if (!(child instanceof Tag) || child.name !== 'p') continue
			if (inline.length) inline.push(new Tag('br', {}, []))
			inline.push(...((child.children ?? []) as (string | Tag)[]))
		}
	}
	return inline
}

/* === Table Helpers === */

const code = (text: string): Tag => new Tag('code', {}, [text])

const td = (children: (string | Tag)[]): Tag => new Tag('td', {}, children)

const dataTable = (headers: string[], rows: Tag[][]): Tag =>
	new Tag('module-scrollarea', { orientation: 'horizontal' }, [
		new Tag('table', {}, [
			new Tag('thead', {}, [
				new Tag(
					'tr',
					{},
					headers.map(label => new Tag('th', {}, [label])),
				),
			]),
			new Tag(
				'tbody',
				{},
				rows.map(cells => new Tag('tr', {}, cells)),
			),
		]),
	])

const formatParameters = (parameters: CemParameter[] = []): string =>
	parameters
		.map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type?.text ?? 'unknown'}`)
		.join(', ')

const fieldsTable = (members: CemMember[]): Tag =>
	dataTable(
		['Name', 'Type', 'Description'],
		members.map(m => [
			td([code(m.name)]),
			td(m.type?.text ? [code(m.type.text)] : []),
			td(parseDescription(m.description ?? '')),
		]),
	)

const methodsTable = (members: CemMember[]): Tag =>
	dataTable(
		['Name', 'Parameters', 'Return', 'Description'],
		members.map(m => [
			td([code(`${m.name}()`)]),
			td(m.parameters?.length ? [code(formatParameters(m.parameters))] : []),
			td([code(m.return?.type?.text ?? 'void')]),
			td(parseDescription(m.description ?? '')),
		]),
	)

const attributesTable = (attributes: CemAttribute[]): Tag =>
	dataTable(
		['Name', 'Field Name', 'Type', 'Default', 'Description'],
		attributes.map(a => [
			td([code(a.name)]),
			td(a.fieldName ? [code(a.fieldName)] : []),
			td(a.type?.text ? [code(a.type.text)] : []),
			td(a.default != null ? [code(a.default)] : []),
			td(parseDescription(a.description ?? '')),
		]),
	)

const namedItemsTable = (items: CemNamedItem[]): Tag =>
	dataTable(
		['Name', 'Description'],
		items.map(i => [
			td([code(i.name)]),
			td(parseDescription(i.description ?? '')),
		]),
	)

/* === Tabgroup Helper === */

/**
 * Builds a `module-tabgroup` with panel ids namespaced by tag name — a
 * catalog page renders many cards, each with its own tabgroup, so ids like
 * `panel_fields` (as authored tabgroups use, see tabgroup.markdoc.ts) would
 * collide across cards.
 */
const buildTabgroup = (
	tagName: string,
	tabs: { label: string; content: Tag }[],
): Tag => {
	const slug = (label: string) =>
		label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
	const withIds = tabs.map(tab => ({
		...tab,
		id: `panel_${tagName}_${slug(tab.label)}`,
	}))

	const tablist = new Tag(
		'div',
		{ role: 'tablist' },
		withIds.map((tab, index) => {
			const isSelected = index === 0
			return new Tag(
				'button',
				{
					role: 'tab',
					id: `trigger_${tab.id}`,
					'aria-controls': tab.id,
					'aria-selected': String(isSelected),
					tabindex: isSelected ? '0' : '-1',
				},
				[tab.label],
			)
		}),
	)

	const tabpanels = withIds.map((tab, index) => {
		const isSelected = index === 0
		const attributes: Record<string, string> = {
			role: 'tabpanel',
			id: tab.id,
			'aria-labelledby': `trigger_${tab.id}`,
		}
		if (!isSelected) attributes.hidden = ''
		return new Tag('div', attributes, [tab.content])
	})

	return new Tag('module-tabgroup', {}, [tablist, ...tabpanels])
}

/**
 * Whether a module has a real demo page under docs/examples/. Mirrors
 * examplesEffect's own convention (server/effects/examples.ts): a page only
 * gets generated for `examples/<group>/<name>/<group>-<name>.ts` paths that
 * have a matching `.md` file next to them — everything else (internal test
 * fixtures under examples/test/**, structural-only elements inlined in
 * examples/main.ts, ...) has no page, so linking to `./${tagName}.html`
 * for those would 404.
 */
const hasDocPage = (modulePath: string): boolean => {
	const parts = modulePath.split('/')
	if (parts.length !== 4 || parts[0] !== 'examples') return false
	const [, group, name, fileName] = parts
	if (fileName !== `${group}-${name}.ts`) return false
	return existsSync(
		getFilePath(ROOT, 'examples', group!, name!, `${group}-${name}.md`),
	)
}

/* === Card Helper === */

const buildCard = (declaration: CemDeclaration): Tag => {
	const tagName = declaration.tagName ?? ''
	const name = declaration.name ?? tagName
	const description = declaration.description ?? ''

	const fields = (declaration.members ?? []).filter(m => m.kind === 'field')
	const methods = (declaration.members ?? []).filter(m => m.kind === 'method')
	const attributes = declaration.attributes ?? []
	const cssProperties = declaration.cssProperties ?? []
	const cssParts = declaration.cssParts ?? []
	const slots = declaration.slots ?? []

	const tabs: { label: string; content: Tag }[] = []
	if (fields.length)
		tabs.push({ label: 'Fields', content: fieldsTable(fields) })
	if (methods.length)
		tabs.push({ label: 'Methods', content: methodsTable(methods) })
	if (attributes.length)
		tabs.push({ label: 'Attributes', content: attributesTable(attributes) })
	if (cssProperties.length)
		tabs.push({
			label: 'CSS Properties',
			content: namedItemsTable(cssProperties),
		})
	if (cssParts.length)
		tabs.push({ label: 'CSS Parts', content: namedItemsTable(cssParts) })
	if (slots.length)
		tabs.push({ label: 'Slots', content: namedItemsTable(slots) })

	const summary = new Tag('summary', {}, [
		new Tag('span', { class: 'header' }, [
			new Tag('strong', { class: 'name' }, [name]),
			code(tagName),
		]),
		new Tag('span', { class: 'description' }, parseDescription(description)),
	])

	// Live demo pages are loaded lazily into examples.html's listnav via a
	// location-hash route (module-listnav.ts maps "#form-checkbox" to
	// "./examples/form-checkbox.html"), not served as their own navigable
	// page — so the link is a hash into examples.html, one directory up from
	// this catalog's own page under docs/examples/, not `./${tagName}.html`.
	const bodyChildren: Tag[] = [
		new Tag('p', { class: 'demo-link' }, [
			new Tag('a', { href: `../examples.html#${tagName}` }, [
				'View live demo →',
			]),
		]),
	]
	if (tabs.length) bodyChildren.push(buildTabgroup(tagName, tabs))

	const details = new Tag('details', {}, [
		summary,
		new Tag('div', { class: 'content' }, bodyChildren),
	])

	return new Tag('card-collapsible', {}, [details])
}

/* === Schema === */

const cemList: Schema = {
	selfClosing: true,
	attributes: {
		src: {
			type: String,
			default: 'custom-elements.json',
		},
	},
	transform(node: Node) {
		const src = (node.attributes.src as string) || 'custom-elements.json'
		const manifestPath = getFilePath(ROOT, src)

		if (!existsSync(manifestPath)) {
			return new Tag('card-callout', { class: 'danger' }, [
				`${src} not found. Run `,
				code('bun run build:cem'),
				' first to generate the custom elements manifest.',
			])
		}

		let manifest: CemManifest
		try {
			manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
		} catch (error) {
			return new Tag('card-callout', { class: 'danger' }, [
				`Failed to parse ${src}: ${error instanceof Error ? error.message : String(error)}`,
			])
		}

		const declarations = (manifest.modules ?? [])
			.filter(m => hasDocPage(m.path))
			.flatMap(m => m.declarations ?? [])
			.filter((d): d is CemDeclaration => !!d.customElement)
			.sort((a, b) => (a.tagName ?? '').localeCompare(b.tagName ?? ''))

		if (declarations.length === 0) {
			return new Tag('card-callout', { class: 'caution' }, [
				`No custom-element declarations found in ${src}.`,
			])
		}

		return new Tag('module-cem-list', {}, declarations.map(buildCard))
	},
}

export default cemList
