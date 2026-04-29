import { createEffect, match } from '@zeix/cause-effect'
import { OUTPUT_DIR, PAGES_DIR } from '../config'
import { docsMarkdown, type PageMetadata } from '../file-signals'
import { getFilePath, getRelativePath, writeFileSafe } from '../io'

/* === Transformation Helpers === */

/** Prefix each non-empty line with "> " for Markdown blockquote format */
const prefixBlockquote = (lines: string[]): string =>
	lines.map(line => (line.trim() ? `> ${line}` : '>')).join('\n')

/** Extract ".classname" from Markdoc attribute string */
const extractClass = (attrs: string): string | null => {
	const m = attrs.match(/\.(\w+)/)
	return m ? (m[1] ?? null) : null
}

/** Extract title="..." value from Markdoc attribute string */
const extractTitle = (attrs: string): string | null => {
	const m = attrs.match(/title="([^"]+)"/)
	return m ? (m[1] ?? null) : null
}

/** Convert a callout tag body to a labelled Markdown blockquote */
const transformCallout = (attrs: string, body: string): string => {
	const label = extractTitle(attrs) ?? extractClass(attrs) ?? 'Note'
	const lines = body.trim().split('\n')
	if (lines.length > 0) {
		lines[0] = `**${label}:** ${lines[0] ?? ''}`
	}
	return `${prefixBlockquote(lines)}\n`
}

/* === Core Transformation === */

/**
 * Strip Markdoc custom tags and convert to standard Markdown.
 * Processes raw Markdown content (frontmatter already removed).
 */
export const stripMarkdocTags = (content: string): string => {
	let result = content

	// tab title="X" → ### heading (must precede bare-tab rule)
	result = result.replace(
		/\{%\s*tab\s+title="([^"]+)"[^%]*%\}([\s\S]*?)\{%\s*\/tab\s*%\}/g,
		(_, title: string, body: string) => `### ${title}\n\n${body.trim()}\n`,
	)

	// bare tab → horizontal rule separator
	result = result.replace(
		/\{%\s*tab\s*%\}([\s\S]*?)\{%\s*\/tab\s*%\}/g,
		(_, body: string) => `---\n\n${body.trim()}\n`,
	)

	// callout → labelled blockquote
	result = result.replace(
		/\{%\s*callout([^%]*?)%\}([\s\S]*?)\{%\s*\/callout\s*%\}/g,
		(_, attrs: string, body: string) => transformCallout(attrs, body),
	)

	// Self-closing tags: strip entirely
	result = result.replace(/\{%\s*blogmeta\s*\/?%\}/g, '')

	// Container tags: strip open/close, keep content
	for (const tag of [
		'tabs',
		'tabgroup',
		'hero',
		'section',
		'carousel',
		'slide',
		'demo',
		'listnav',
		'blogpost',
	]) {
		result = result.replace(new RegExp(`\\{%\\s*${tag}[^%]*?%\\}`, 'g'), '')
		result = result.replace(new RegExp(`\\{%\\s*\\/${tag}\\s*%\\}`, 'g'), '')
	}

	// Collapse runs of 3+ blank lines to 2
	result = result.replace(/\n{3,}/g, '\n\n')

	return result.trim()
}

/* === Frontmatter Reconstruction === */

/** Rebuild a minimal YAML frontmatter block from parsed page metadata */
export const serializeFrontmatter = (metadata: PageMetadata): string => {
	const fields: string[] = []
	if (metadata.title) fields.push(`title: ${JSON.stringify(metadata.title)}`)
	if (metadata.description)
		fields.push(`description: ${JSON.stringify(metadata.description)}`)
	if (metadata.emoji) fields.push(`emoji: ${JSON.stringify(metadata.emoji)}`)
	if (metadata.date) fields.push(`date: ${metadata.date}`)
	if (metadata.author) fields.push(`author: ${JSON.stringify(metadata.author)}`)
	if (metadata.tags?.length) fields.push(`tags: ${metadata.tags.join(', ')}`)
	return fields.length ? `---\n${fields.join('\n')}\n---\n\n` : ''
}

/* === Effect === */

export const mdMirrorEffect = (onRebuild?: () => void) => {
	let resolve: (() => void) | undefined
	const ready = new Promise<void>(res => {
		resolve = res
	})

	const cleanup = createEffect(() => {
		match([docsMarkdown.processed], {
			ok: async ([processedFiles]): Promise<void> => {
				const firstRun = !!resolve
				try {
					console.log('🪞 Generating Markdown mirrors...')

					const writePromises = Array.from(processedFiles.entries()).map(
						async ([path, file]) => {
							const relativePath = getRelativePath(PAGES_DIR, path)
							if (!relativePath) return

							const frontmatter = serializeFrontmatter(file.metadata)
							const cleanContent = stripMarkdocTags(file.content)
							const output = `${frontmatter}${cleanContent}\n`

							await writeFileSafe(getFilePath(OUTPUT_DIR, relativePath), output)
						},
					)

					await Promise.all(writePromises)
					console.log(
						`🪞 Generated ${processedFiles.size} Markdown mirror${processedFiles.size === 1 ? '' : 's'}`,
					)
					if (!firstRun) onRebuild?.()
				} catch (error) {
					console.error('Failed to generate Markdown mirrors:', error)
				} finally {
					resolve?.()
					resolve = undefined
				}
			},
			err: errors => {
				console.error('Error in mdMirrorEffect:', errors[0]!.message)
				resolve?.()
				resolve = undefined
			},
		})
	})

	return { cleanup, ready }
}
