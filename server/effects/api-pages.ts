import Markdoc, {
	type RenderableTreeNode,
	type RenderableTreeNodes,
	Tag,
} from '@markdoc/markdoc'
import { createEffect, match } from '@zeix/cause-effect'
import { API_DIR, OUTPUT_DIR } from '../config'
import { apiMarkdown, type FileInfo } from '../file-signals'
import { highlightCodeBlocks } from '../html-shaping'
import { getFilePath, getRelativePath, writeFileSafe } from '../io'
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
			Tag.isTag(node)
			&& node.name === 'blockquote'
			&& Tag.isTag(next)
			&& next.name === 'p'
			&& firstTextContent(next).startsWith('Defined in:')
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
			ancestors.length
			&& ancestors[ancestors.length - 1]!.level >= level
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
const processApiFile = async (file: FileInfo): Promise<void> => {
	const relativePath = getRelativePath(API_DIR, file.path)
	if (!relativePath) return

	// Skip index files — only process individual API entries
	const filename = relativePath.split('/').pop() || ''
	if (
		filename === 'globals.md'
		|| filename === 'README.md'
		|| filename.startsWith('_')
	) {
		return
	}

	// Strip TypeDoc navigation breadcrumbs and link external "Defined in:" paths
	const cleanContent = linkExternalDefinedIn(stripBreadcrumbs(file.content))

	// Parse with Markdoc
	const ast = Markdoc.parse(cleanContent)
	const errors = Markdoc.validate(ast, markdocConfig)
	if (errors.length > 0) {
		console.warn(`Markdoc validation warnings for ${relativePath}:`, errors)
	}

	const transformed = makeHeadingIdsUnique(
		convertParameterSectionsToTables(
			mergeDefinedInIntoBlockquote(Markdoc.transform(ast, markdocConfig)),
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
	convertParameterSectionsToTables,
	linkExternalDefinedIn,
	makeHeadingIdsUnique,
	mergeDefinedInIntoBlockquote,
	stripBreadcrumbs,
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

					let count = 0
					const processPromises = apiFiles.map(async (file: FileInfo) => {
						try {
							await processApiFile(file)
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
