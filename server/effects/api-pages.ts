import Markdoc, {
	type RenderableTreeNode,
	type RenderableTreeNodes,
	Tag,
} from '@markdoc/markdoc'
import { createEffect, match } from '@zeix/cause-effect'
import { ADR_DIR, API_DIR, OUTPUT_DIR } from '../config'
import { apiMarkdown, type FileInfo } from '../file-signals'
import { highlightCodeBlocks } from '../html-shaping'
import {
	getDirectoryEntries,
	getFilePath,
	getRelativePath,
	writeFileSafe,
} from '../io'
import markdocConfig from '../markdoc.config'

/* === Internal Functions === */

/** Strip TypeDoc navigation breadcrumbs above the first H1 heading */
const stripBreadcrumbs = (content: string): string => {
	const h1Match = content.match(/^(#\s+.+)$/m)
	if (h1Match) {
		const h1Index = content.indexOf(h1Match[0])
		return content.substring(h1Index)
	}
	return content
}

/** GitHub repo (org/name) for each @zeix dependency whose declarations show up in "Defined in:" lines. */
const ZEIX_DEPENDENCY_REPOS: Record<string, string> = {
	'cause-effect': 'zeixcom/cause-effect',
}

const NODE_MODULES_DEFINED_IN =
	/Defined in: node\\?_modules\/@zeix\/([\w-]+)\/types\/(.+?)\.d\.ts:\d+/g

/**
 * TypeDoc can't generate a source link for declaration files outside this
 * repo, so a symbol re-exported from an @zeix dependency gets a plain
 * "Defined in: node_modules/@zeix/<pkg>/types/<path>.d.ts:<line>" path
 * instead of a link. The rolled-up .d.ts mirrors the dependency's
 * src/<path>.ts 1:1, so rewrite it into a link to that file on GitHub.
 * Line numbers in the .d.ts don't correspond to the original .ts source, so
 * the link points at the file, not a line. Unknown @zeix packages are left
 * untouched.
 */
const linkExternalDefinedIn = (content: string): string =>
	content.replace(
		NODE_MODULES_DEFINED_IN,
		(match, pkg: string, path: string) => {
			const repo = ZEIX_DEPENDENCY_REPOS[pkg]
			if (!repo) return match
			return `Defined in: [${path}.ts](https://github.com/${repo}/blob/main/${path}.ts)`
		},
	)

/**
 * Matches an "ADR NNNN" mention anywhere in prose, not anchored to a specific
 * surrounding phrase or trailing punctuation — the codebase's actual JSDoc
 * convention varies ("See ADR 0011.", "see ADR 0007)", "See ADR 0017 for
 * full rationale..."). Case-insensitive as a safety margin; the acronym is
 * written "ADR" everywhere observed.
 */
const ADR_REFERENCE = /\bADR (\d{4})\b/gi

/**
 * List `adr/` and map ADR number to its filename slug (without extension),
 * so inline "See ADR NNNN." prose can be turned into a real link. Not cached:
 * re-reading is cheap (a couple dozen tiny files) and picks up newly recorded
 * ADRs immediately under HMR/file-watch rebuilds, same reasoning as
 * `loadPartials()` in effects/examples.ts.
 */
const loadAdrSlugMap = async (): Promise<Record<string, string>> => {
	const entries = await getDirectoryEntries(ADR_DIR)
	const map: Record<string, string> = {}
	for (const entry of entries) {
		if (!entry.isFile()) continue
		const match = entry.name.match(/^(\d{4})-.+\.md$/)
		if (match) map[match[1]!] = entry.name.replace(/\.md$/, '')
	}
	return map
}

/**
 * Rewrite inline "ADR NNNN" mentions (plain prose in JSDoc, TypeDoc emits
 * them unlinked) into a link to the ADR file on GitHub — this pipeline
 * doesn't ship `adr/` into `docs/`, so link out rather than to a local path,
 * same reasoning `linkExternalDefinedIn` uses for `node_modules` dependency
 * source links. Only the "ADR NNNN" span itself is replaced, leaving
 * surrounding punctuation/phrasing untouched, so this reads correctly
 * whether the mention is "See ADR 0011.", mid-sentence ("see ADR 0007)"),
 * or followed by more prose ("See ADR 0017 for full rationale"). An ADR
 * number with no matching file (typo, renumbered) is left as plain text
 * with a warning rather than thrown.
 */
const linkAdrReferences = (
	content: string,
	adrSlugs: Record<string, string>,
): string =>
	content.replace(ADR_REFERENCE, (match, number: string) => {
		const slug = adrSlugs[number]
		if (!slug) {
			console.warn(`No ADR file found for referenced ADR ${number}`)
			return match
		}
		return `[ADR ${number}](https://github.com/zeixcom/le-truc/blob/main/adr/${slug}.md)`
	})

/** Recursively read the first text content of a renderable node */
const firstTextContent = (node: RenderableTreeNode): string => {
	if (typeof node === 'string') return node
	if (Tag.isTag(node) && node.children.length > 0)
		return firstTextContent(node.children[0]!)
	return ''
}

/**
 * TypeDoc emits a contract's source location as a standalone "Defined in: ..."
 * paragraph directly after its signature blockquote. Move it inside the
 * blockquote as a <cite> so it reads as part of the contract.
 */
const mergeDefinedInIntoBlockquote = (
	root: RenderableTreeNodes,
): RenderableTreeNodes => {
	if (!Tag.isTag(root)) return root

	const children: RenderableTreeNode[] = []
	for (let i = 0; i < root.children.length; i++) {
		const node = root.children[i]!
		const next = root.children[i + 1]
		if (
			Tag.isTag(node) &&
			node.name === 'blockquote' &&
			Tag.isTag(next) &&
			next.name === 'p' &&
			firstTextContent(next).startsWith('Defined in:')
		) {
			children.push(
				new Tag('blockquote', node.attributes, [
					...node.children,
					new Tag('cite', {}, next.children),
				]),
			)
			i++ // the "Defined in:" paragraph was merged in, skip it
			continue
		}
		children.push(node)
	}
	return new Tag(root.name, root.attributes, children)
}

/** Headings TypeDoc uses to mark the end of a "Type Parameters"/"Parameters" item list or a "Returns" value */
const PARAM_SECTION_STOP_LABELS = new Set([
	'Type Parameters',
	'Parameters',
	'Returns',
	'Overrides',
	'Inherited from',
	'Throws',
	'Since',
	'Deprecated',
	'Default',
	'Default Value',
	'Example',
	'Examples',
	'Call Signature',
	'Construct Signature',
	'Type Declaration',
	'See',
	'Remarks',
	'Implementation of',
	'Extends',
	'Defined in',
])

const headingTagLevel = (tag: RenderableTreeNode): number | null =>
	Tag.isTag(tag) && /^h[1-6]$/.test(tag.name) ? Number(tag.name[1]) : null

/** Read the visible text of a heading built by createAccessibleHeading (h > a.anchor > span.title > text) */
const headingTagText = (tag: RenderableTreeNode): string => {
	if (!Tag.isTag(tag)) return ''
	const anchor = tag.children[0]
	if (!Tag.isTag(anchor)) return ''
	const titleSpan = anchor.children[0]!
	return firstTextContent(titleSpan)
}

type NamedRow = {
	name: string
	typeNodes: RenderableTreeNode[]
	descriptionNodes: RenderableTreeNode[]
}

/**
 * Collect "##### name / type-paragraph / description-paragraph?" groups following a
 * "Type Parameters" or "Parameters" heading at level `sectionLevel`. Item headings are
 * normally exactly one level deeper than the section heading — that's the reliable
 * signal, since arbitrary sibling headings (e.g. "Constructors", "Properties") sit at
 * or above the section's own level and must never be mistaken for items. The one
 * exception: once heading depth maxes out at h6, TypeDoc's heading-shift logic clamps
 * item headings back to a shallower level instead of nesting deeper, making them
 * indistinguishable from terminators by level alone — so at that ceiling only, item
 * boundaries fall back to heading text (anything not a known section label).
 * Stops — without consuming — at the first node it can't interpret, leaving it for
 * the caller to render unchanged.
 */
const extractNamedRows = (
	siblings: RenderableTreeNode[],
	startIndex: number,
	sectionLevel: number,
): { rows: NamedRow[]; nextIndex: number } | null => {
	const rows: NamedRow[] = []
	let current: NamedRow | null = null
	let i = startIndex
	while (i < siblings.length) {
		const node = siblings[i]!
		if (!Tag.isTag(node)) break
		const level = headingTagLevel(node)
		if (level !== null) {
			const text = headingTagText(node)
			const isItem =
				sectionLevel < 6
					? level === sectionLevel + 1
					: !PARAM_SECTION_STOP_LABELS.has(text)
			if (!isItem) break
			current = { name: text, typeNodes: [], descriptionNodes: [] }
			rows.push(current)
			i++
			continue
		}
		if (node.name === 'p') {
			if (!current) return null
			if (current.typeNodes.length === 0) current.typeNodes = node.children
			else {
				if (current.descriptionNodes.length) current.descriptionNodes.push(' ')
				current.descriptionNodes.push(...node.children)
			}
			i++
			continue
		}
		break
	}
	if (rows.length === 0) return null
	return { rows, nextIndex: i }
}

/**
 * Collect the type paragraph and optional description paragraph(s) following a
 * "Returns" heading. Return values are unnamed, so unlike extractNamedRows this
 * never looks for item headings — any heading, hr, or blockquote ends the value
 * (e.g. an inline object return type documents its fields as further headings,
 * or the value is itself a multi-signature callable), leaving it unconverted.
 */
const extractReturnsValue = (
	siblings: RenderableTreeNode[],
	startIndex: number,
): {
	typeNodes: RenderableTreeNode[]
	descriptionNodes: RenderableTreeNode[]
	nextIndex: number
} | null => {
	const first = siblings[startIndex]
	if (!Tag.isTag(first) || first.name !== 'p') return null

	const descriptionNodes: RenderableTreeNode[] = []
	let i = startIndex + 1
	while (i < siblings.length) {
		const node = siblings[i]!
		if (!Tag.isTag(node) || node.name !== 'p') break
		if (descriptionNodes.length) descriptionNodes.push(' ')
		descriptionNodes.push(...node.children)
		i++
	}
	return { typeNodes: first.children, descriptionNodes, nextIndex: i }
}

const wrapTable = (headerLabels: string[], bodyRows: Tag[]): Tag =>
	new Tag('module-scrollarea', { orientation: 'horizontal' }, [
		new Tag('table', {}, [
			new Tag('thead', {}, [
				new Tag(
					'tr',
					{},
					headerLabels.map(label => new Tag('th', { scope: 'col' }, [label])),
				),
			]),
			new Tag('tbody', {}, bodyRows),
		]),
	])

const buildNamedRowsTable = (rows: NamedRow[]): Tag =>
	wrapTable(
		['Name', 'Type', 'Description'],
		rows.map(
			row =>
				new Tag('tr', {}, [
					new Tag('td', {}, [new Tag('strong', {}, [row.name])]),
					new Tag('td', {}, row.typeNodes),
					new Tag('td', {}, row.descriptionNodes),
				]),
		),
	)

const buildReturnsTable = (
	typeNodes: RenderableTreeNode[],
	descriptionNodes: RenderableTreeNode[],
): Tag =>
	wrapTable(
		['Type', 'Description'],
		[
			new Tag('tr', {}, [
				new Tag('td', {}, typeNodes),
				new Tag('td', {}, descriptionNodes),
			]),
		],
	)

/**
 * Render TypeDoc's "Type Parameters", "Parameters", and "Returns" sections as
 * tables with a visually-hidden header row, keeping the section heading itself.
 * Leaves a section untouched if its content doesn't match the expected shape.
 */
const convertParameterSectionsToTables = (
	root: RenderableTreeNodes,
): RenderableTreeNodes => {
	if (!Tag.isTag(root)) return root

	const children: RenderableTreeNode[] = []
	const siblings = root.children
	let i = 0
	while (i < siblings.length) {
		const node = siblings[i]!
		const level = headingTagLevel(node)
		const text = level !== null ? headingTagText(node) : null

		if (text === 'Type Parameters' || text === 'Parameters') {
			const extracted = extractNamedRows(siblings, i + 1, level!)
			if (extracted) {
				children.push(node, buildNamedRowsTable(extracted.rows))
				i = extracted.nextIndex
				continue
			}
		} else if (text === 'Returns') {
			const extracted = extractReturnsValue(siblings, i + 1)
			if (extracted) {
				children.push(
					node,
					buildReturnsTable(extracted.typeNodes, extracted.descriptionNodes),
				)
				i = extracted.nextIndex
				continue
			}
		}
		children.push(node)
		i++
	}
	return new Tag(root.name, root.attributes, children)
}

/**
 * Wrap the content following a "Deprecated" heading in a loud `caution`
 * `card-callout` with a title (same shape server/schema/callout.markdoc.ts
 * produces), dropping the original heading since the callout carries that
 * meaning now — this is the case that should actually catch a reader's eye.
 *
 * "Since" deliberately does NOT get this treatment: every `card-callout`
 * class (including `.note`) renders as a full padded/bordered/icon box in
 * `examples/card/callout/card-callout.css` — there's no quiet variant — and
 * "Since" appears on nearly every symbol (multiple times on anything
 * overloaded, e.g. 6× on createSignal.html), so wrapping it produced a wall
 * of colored boxes for a single version string. Left as plain text.
 */
const wrapDeprecatedCallout = (
	root: RenderableTreeNodes,
): RenderableTreeNodes => {
	if (!Tag.isTag(root)) return root

	const children: RenderableTreeNode[] = []
	const siblings = root.children
	let i = 0
	while (i < siblings.length) {
		const node = siblings[i]!
		const level = headingTagLevel(node)
		const text = level !== null ? headingTagText(node) : null

		if (text === 'Deprecated') {
			const body: RenderableTreeNode[] = []
			let j = i + 1
			while (j < siblings.length && headingTagLevel(siblings[j]!) === null) {
				body.push(siblings[j]!)
				j++
			}
			if (body.length === 0) {
				children.push(node)
				i++
				continue
			}
			children.push(
				new Tag('card-callout', { class: 'caution' }, [
					new Tag('p', {}, [new Tag('strong', {}, ['Deprecated'])]),
					...body,
				]),
			)
			i = j
			continue
		}
		children.push(node)
		i++
	}
	return new Tag(root.name, root.attributes, children)
}

const CALL_SIGNATURE_LABEL = 'Call Signature'

/**
 * Collect the body of a single "Call Signature" section: everything after
 * the heading up to (not including) the next "Call Signature" heading (next
 * overload) or a heading whose text isn't a recognized sub-section label (a
 * new symbol/section entirely, not part of this overload). Heading *level*
 * isn't a reliable boundary here — TypeDoc's h6-depth-ceiling clamping can
 * put a Call Signature's own children (Returns, Inherited from, ...) at a
 * shallower level than the Call Signature heading itself (see
 * `composedPath()` in ContextRequestEvent.md, an inherited DOM overload).
 */
const collectCallSignatureBody = (
	siblings: RenderableTreeNode[],
	startIndex: number,
): { body: RenderableTreeNode[]; nextIndex: number } => {
	const body: RenderableTreeNode[] = []
	let i = startIndex
	while (i < siblings.length) {
		const node = siblings[i]!
		const level = headingTagLevel(node)
		if (level !== null) {
			const text = headingTagText(node)
			if (text === CALL_SIGNATURE_LABEL) break
			if (!PARAM_SECTION_STOP_LABELS.has(text)) break
		}
		body.push(node)
		i++
	}
	return { body, nextIndex: i }
}

/**
 * Tab structure identical to what server/schema/tabgroup.markdoc.ts produces.
 * `groupIndex` disambiguates ids across multiple overloaded methods on the
 * same page (e.g. ContextRequestEvent.md has overloads on both
 * composedPath() and preventDefault()) — without it every tab group would
 * emit the same "panel_overload-1"/"panel_overload-2" ids, which is invalid
 * HTML and breaks aria-controls/aria-labelledby wiring.
 */
const buildOverloadTabGroup = (
	groups: RenderableTreeNode[][],
	groupIndex: number,
): Tag => {
	const tabs = groups.map((body, index) => ({
		label: `Overload ${index + 1}`,
		id: `panel_overload-${groupIndex}-${index + 1}`,
		body,
	}))

	const tablist = new Tag(
		'div',
		{ role: 'tablist' },
		tabs.map((tab, index) => {
			const isSelected = index === 0
			const triggerId = tab.id.replace('panel_', 'trigger_')
			return new Tag(
				'button',
				{
					role: 'tab',
					id: triggerId,
					'aria-controls': tab.id,
					'aria-selected': String(isSelected),
					tabindex: isSelected ? '0' : '-1',
				},
				[tab.label],
			)
		}),
	)

	const tabpanels = tabs.map((tab, index) => {
		const isSelected = index === 0
		const triggerId = tab.id.replace('panel_', 'trigger_')
		const attributes: Record<string, string> = {
			role: 'tabpanel',
			id: tab.id,
			'aria-labelledby': triggerId,
		}
		if (!isSelected) attributes.hidden = ''
		return new Tag('div', attributes, [new Tag(undefined, {}, tab.body)])
	})

	return new Tag('module-tabgroup', {}, [tablist, ...tabpanels])
}

/**
 * TypeDoc emits one "Call Signature" heading per overload, all as siblings
 * under the same symbol heading, with no label distinguishing one overload
 * from another (e.g. createElementsMemo()'s two generic signatures, or
 * composedPath()'s inherited DOM overloads). Replace ≥2 consecutive Call
 * Signature groups with a tab group labeled "Overload 1", "Overload 2", etc.
 * A lone Call Signature (no sibling) is left untouched.
 */
const mergeOverloadCallSignatures = (
	root: RenderableTreeNodes,
): RenderableTreeNodes => {
	if (!Tag.isTag(root)) return root

	const children: RenderableTreeNode[] = []
	const siblings = root.children
	let groupCount = 0
	let i = 0
	while (i < siblings.length) {
		const node = siblings[i]!
		const level = headingTagLevel(node)
		const text = level !== null ? headingTagText(node) : null

		if (text === CALL_SIGNATURE_LABEL) {
			const groups: RenderableTreeNode[][] = []
			let j = i
			while (
				j < siblings.length &&
				headingTagLevel(siblings[j]!) !== null &&
				headingTagText(siblings[j]!) === CALL_SIGNATURE_LABEL
			) {
				const { body, nextIndex } = collectCallSignatureBody(siblings, j + 1)
				groups.push(body)
				j = nextIndex
			}

			if (groups.length < 2) {
				children.push(node, ...groups[0]!)
				i = j
				continue
			}

			groupCount++
			children.push(buildOverloadTabGroup(groups, groupCount))
			i = j
			continue
		}

		children.push(node)
		i++
	}
	return new Tag(root.name, root.attributes, children)
}

type MemberEntry = {
	heading: RenderableTreeNode
	body: RenderableTreeNode[]
}

/**
 * Collect "member heading + body" entries directly under a Properties/Methods
 * section heading, one level deeper. Unlike `extractNamedRows`, member bodies
 * can contain their own sub-headings (Inherited from, Deprecated, Call
 * Signature, ...) at deeper levels — only a heading at exactly
 * `sectionLevel + 1` starts a new member; anything deeper is body content,
 * and anything at `sectionLevel` or shallower ends the section. Properties/
 * Methods headings sit at a shallow level in practice (never near the h6
 * ceiling `extractNamedRows` has to guard against), so this simpler
 * level-only check is sufficient here.
 */
const extractMemberEntries = (
	siblings: RenderableTreeNode[],
	startIndex: number,
	sectionLevel: number,
): { entries: MemberEntry[]; nextIndex: number } | null => {
	const entries: MemberEntry[] = []
	let current: MemberEntry | null = null
	let i = startIndex
	while (i < siblings.length) {
		const node = siblings[i]!
		const level = headingTagLevel(node)
		if (level !== null && level <= sectionLevel) break
		if (level === sectionLevel + 1) {
			current = { heading: node, body: [] }
			entries.push(current)
			i++
			continue
		}
		if (!current) return null
		current.body.push(node)
		i++
	}
	if (entries.length === 0) return null
	return { entries, nextIndex: i }
}

/** Recursively search a node list for a heading with the given exact text. */
const containsHeadingText = (
	nodes: RenderableTreeNode[],
	text: string,
): boolean =>
	nodes.some(node => {
		if (!Tag.isTag(node)) return false
		if (headingTagLevel(node) !== null) return headingTagText(node) === text
		return containsHeadingText(node.children, text)
	})

/** Collapsible structure identical to server/schema/collapsible.markdoc.ts. */
const buildInheritedMembersCollapsible = (entries: MemberEntry[]): Tag => {
	const content = entries.flatMap(entry => [entry.heading, ...entry.body])
	return new Tag('card-collapsible', {}, [
		new Tag('details', {}, [
			new Tag('summary', {}, [
				new Tag('span', { class: 'description' }, [
					`Inherited members (${entries.length})`,
				]),
			]),
			new Tag('div', { class: 'content' }, content),
		]),
	])
}

const MEMBER_SECTION_LABELS = new Set(['Properties', 'Methods'])

/**
 * Classes/interfaces extending a large native type are dominated by inherited
 * boilerplate (e.g. FormAssociatedElement.md: 314 inherited vs. 255 own
 * members). Within each Properties/Methods section, pull out any member
 * whose body contains a descendant "Inherited from" heading — recursively,
 * so members already re-nested by `mergeOverloadCallSignatures` (which runs
 * first) are still found — and group them into a single collapsible appended
 * after the own members, which stay inline in original order.
 */
const collapseInheritedMembers = (
	root: RenderableTreeNodes,
): RenderableTreeNodes => {
	if (!Tag.isTag(root)) return root

	const children: RenderableTreeNode[] = []
	const siblings = root.children
	let i = 0
	while (i < siblings.length) {
		const node = siblings[i]!
		const level = headingTagLevel(node)
		const text = level !== null ? headingTagText(node) : null

		if (level !== null && MEMBER_SECTION_LABELS.has(text!)) {
			const extracted = extractMemberEntries(siblings, i + 1, level)
			if (extracted) {
				const ownEntries: MemberEntry[] = []
				const inheritedEntries: MemberEntry[] = []
				for (const entry of extracted.entries) {
					if (containsHeadingText(entry.body, 'Inherited from')) {
						inheritedEntries.push(entry)
					} else {
						ownEntries.push(entry)
					}
				}
				children.push(node)
				for (const entry of ownEntries)
					children.push(entry.heading, ...entry.body)
				if (inheritedEntries.length > 0) {
					children.push(buildInheritedMembersCollapsible(inheritedEntries))
				}
				i = extracted.nextIndex
				continue
			}
		}

		children.push(node)
		i++
	}
	return new Tag(root.name, root.attributes, children)
}

/**
 * Headings built by createAccessibleHeading() carry generic labels ("Parameters",
 * "Returns", "Inherited from", "Call Signature") that repeat across every constructor,
 * property, and method on a generated API page, producing duplicate ids. Walk the page
 * in document order, prefixing each heading's id with its nearest shallower-level
 * ancestor's (already-unique) id. Falls back to an incrementing counter on any
 * remaining clash — e.g. multiple overloads of the same method, whose item headings
 * TypeDoc clamps back to the same depth once nesting hits the h6 ceiling (see
 * extractNamedRows above), so prefixing alone can't tell them apart.
 *
 * TypeDoc also emits same-page links to a member's own heading (e.g. an "Inherited
 * from" line linking back to `#bubbles`). A second pass rewrites those by the old,
 * pre-prefix id so they keep pointing at the right heading.
 */
const makeHeadingIdsUnique = (
	root: RenderableTreeNodes,
): RenderableTreeNodes => {
	const usedIds = new Set<string>()
	const ancestors: { level: number; id: string }[] = []
	const idsBeforePrefixing = new Map<string, string>()

	const uniquify = (candidate: string): string => {
		if (!usedIds.has(candidate)) return candidate
		let suffix = 2
		while (usedIds.has(`${candidate}-${suffix}`)) suffix++
		return `${candidate}-${suffix}`
	}

	const withId = (tag: Tag, id: string): Tag => {
		const [anchor, ...rest] = tag.children
		const newAnchor =
			Tag.isTag(anchor) && anchor.name === 'a'
				? new Tag(
						'a',
						{ ...anchor.attributes, href: `#${id}` },
						anchor.children,
					)
				: anchor
		return new Tag(
			tag.name,
			{ ...tag.attributes, id },
			newAnchor === undefined ? rest : [newAnchor, ...rest],
		)
	}

	const renameHeadings = (node: RenderableTreeNode): RenderableTreeNode => {
		if (!Tag.isTag(node)) return node
		const level = headingTagLevel(node)
		if (level === null) {
			return new Tag(
				node.name,
				node.attributes,
				node.children.map(renameHeadings),
			)
		}

		while (
			ancestors.length &&
			ancestors[ancestors.length - 1]!.level >= level
		) {
			ancestors.pop()
		}
		const ownId =
			typeof node.attributes.id === 'string' ? node.attributes.id : ''
		const parent = ancestors[ancestors.length - 1]
		const id = uniquify(parent ? `${parent.id}-${ownId}` : ownId)
		usedIds.add(id)
		ancestors.push({ level, id })
		if (ownId && !idsBeforePrefixing.has(ownId)) {
			idsBeforePrefixing.set(ownId, id)
		}
		return withId(node, id)
	}

	const rewriteSamePageLinks = (
		node: RenderableTreeNode,
	): RenderableTreeNode => {
		if (!Tag.isTag(node)) return node
		const children = node.children.map(rewriteSamePageLinks)
		const href = node.attributes.href
		if (node.name === 'a' && typeof href === 'string' && href.startsWith('#')) {
			const target = idsBeforePrefixing.get(href.slice(1))
			if (target) {
				return new Tag(
					node.name,
					{ ...node.attributes, href: `#${target}` },
					children,
				)
			}
		}
		return new Tag(node.name, node.attributes, children)
	}

	const renamed = Array.isArray(root)
		? root.map(renameHeadings)
		: renameHeadings(root)
	return Array.isArray(renamed)
		? renamed.map(rewriteSamePageLinks)
		: rewriteSamePageLinks(renamed)
}

/**
 * Process a single API markdown file into an HTML fragment.
 *
 * Fragments are suitable for injection by module-lazyload (no doctype/head/body).
 * The server applies the full api.html layout on-the-fly for direct navigation.
 */
const processApiFile = async (
	file: FileInfo,
	adrSlugs: Record<string, string>,
): Promise<void> => {
	const relativePath = getRelativePath(API_DIR, file.path)
	if (!relativePath) return

	// Skip index files — only process individual API entries
	const filename = relativePath.split('/').pop() || ''
	if (
		filename === 'globals.md' ||
		filename === 'README.md' ||
		filename.startsWith('_')
	) {
		return
	}

	// Strip TypeDoc navigation breadcrumbs, link external "Defined in:" paths
	// and inline "See ADR NNNN." references
	const cleanContent = linkAdrReferences(
		linkExternalDefinedIn(stripBreadcrumbs(file.content)),
		adrSlugs,
	)

	// Parse with Markdoc
	const ast = Markdoc.parse(cleanContent)
	const errors = Markdoc.validate(ast, markdocConfig)
	if (errors.length > 0) {
		console.warn(`Markdoc validation warnings for ${relativePath}:`, errors)
	}

	// Passes that scan the flat top-level tree must run before the passes
	// that nest content (tabs, collapsibles) — nesting passes only need to
	// run in an order where each still finds what it depends on; see the
	// doc comments on collectCallSignatureBody/collapseInheritedMembers.
	const transformed = makeHeadingIdsUnique(
		collapseInheritedMembers(
			mergeOverloadCallSignatures(
				wrapDeprecatedCallout(
					convertParameterSectionsToTables(
						mergeDefinedInIntoBlockquote(Markdoc.transform(ast, markdocConfig)),
					),
				),
			),
		),
	)
	let htmlContent = Markdoc.renderers.html(transformed)

	// Remove automatic <article> wrapper
	htmlContent = htmlContent.replace(/^<article>([\s\S]*)<\/article>$/m, '$1')

	// Highlight code blocks
	htmlContent = await highlightCodeBlocks(htmlContent)

	// Rewrite relative API cross-references to hash links
	const category = relativePath.split('/')[0] // e.g. "type-aliases"

	// "../type-aliases/Fallback.html" → "#type-aliases/Fallback"
	htmlContent = htmlContent.replace(
		/href="\.\.\/([^"]+)\.html"/g,
		(_, path) => `href="#${path}"`,
	)

	// "ComponentProp.html" → "#type-aliases/ComponentProp" (same-directory links)
	htmlContent = htmlContent.replace(
		/href="([A-Za-z][^/"]*?)\.html"/g,
		(_, name) => `href="#${category}/${name}"`,
	)

	// Write HTML fragment to output (for listnav lazy-loading)
	const outputPath = getFilePath(
		OUTPUT_DIR,
		'api',
		relativePath.replace('.md', '.html'),
	)
	await writeFileSafe(outputPath, htmlContent)
}

/* === Exported Functions === */

// Exported for testing
export {
	collapseInheritedMembers,
	convertParameterSectionsToTables,
	linkAdrReferences,
	linkExternalDefinedIn,
	loadAdrSlugMap,
	makeHeadingIdsUnique,
	mergeDefinedInIntoBlockquote,
	mergeOverloadCallSignatures,
	stripBreadcrumbs,
	wrapDeprecatedCallout,
}

export const apiPagesEffect = (onRebuild?: () => void) => {
	let resolve: (() => void) | undefined
	const ready = new Promise<void>(res => {
		resolve = res
	})
	const cleanup = createEffect(() => {
		match([apiMarkdown.sources], {
			ok: async ([apiFiles]) => {
				const firstRun = !!resolve
				try {
					console.log('📖 Generating API page fragments...')

					const adrSlugs = await loadAdrSlugMap()
					let count = 0
					const processPromises = apiFiles.map(async (file: FileInfo) => {
						try {
							await processApiFile(file, adrSlugs)
							count++
						} catch (error) {
							console.error(`Failed to process API file ${file.path}:`, error)
						}
					})

					await Promise.all(processPromises)
					console.log(`📖 Generated ${count} API page fragments`)
					if (!firstRun) onRebuild?.()
				} catch (error) {
					console.error('Failed to generate API pages:', error)
				} finally {
					resolve?.()
					resolve = undefined
				}
			},
			err: errors => {
				console.error('Error in API pages effect:', errors[0]!.message)
				resolve?.()
				resolve = undefined
			},
		})
	})
	return { cleanup, ready }
}
