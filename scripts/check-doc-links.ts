/**
 * Doc link checker — validates internal links and anchors in markdown docs.
 *
 * Scans adr/*.md, ARCHITECTURE.md, REQUIREMENTS.md, AGENTS.md for markdown links
 * of the form [text](relative-path) or [text](relative-path#fragment). For each:
 *   1. Resolves the target file relative to the containing file's directory.
 *   2. Asserts the file exists.
 *   3. If a #fragment is present, slugifies the destination file's headings
 *      GitHub-style and asserts the fragment matches one.
 *
 * External links (http://, https://, mailto:, ftp://) are skipped.
 * Bare hash links (#fragment, same-document) are checked against the current file.
 *
 * Slugify rule (GitHub-compatible for this repo's ASCII unique headings):
 *   lowercase, strip backticks, drop chars other than [a-z0-9 -], spaces → hyphens.
 *
 * Usage: bun run check:links
 * Exits 1 listing every broken link as file:line → target.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// --- Files to scan -----------------------------------------------------------

const scanFiles: string[] = []

function addMarkdownFiles(dir: string, recursive = false) {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry)
		const stat = statSync(full)
		if (stat.isDirectory() && recursive) {
			addMarkdownFiles(full, true)
		} else if (extname(entry) === '.md') {
			scanFiles.push(full)
		}
	}
}

// adr/ — recursive, all ADRs + template
addMarkdownFiles(join(ROOT, 'adr'), false)
// root-level docs
for (const f of ['ARCHITECTURE.md', 'REQUIREMENTS.md', 'AGENTS.md']) {
	const full = join(ROOT, f)
	if (existsSync(full)) scanFiles.push(full)
}

// --- Markdown link regex -----------------------------------------------------
// Matches [text](target), skipping code spans (`` ` ``), image links, and
// <autolinks>. Negative lookbehind avoids matching inside inline code by
// a simple heuristic: links preceded by a backtick are skipped in post-filter.
const LINK_RE = /(?<!`)!\[(?:[^\]]*)\]\(([^)]+)\)|(?<!`)\[([^\]]+)\]\(([^)]+)\)/g

// --- Slugify (GitHub-compatible for this repo) -------------------------------

function slugify(heading: string): string {
	return heading
		.toLowerCase()
		.replace(/`/g, '') // strip backticks
		.replace(/[^a-z0-9 -]/g, '') // drop non-alnum (keeps spaces and hyphens)
		.replace(/\s/g, '-') // each space → one hyphen (no collapsing!)
		.replace(/^-|-$/g, '') // trim leading/trailing hyphens
	// GitHub does NOT collapse runs of spaces or hyphens. A heading like
	// "Attribute → property" slugifies to "attribute--property": the arrow
	// drops, leaving its two flanking spaces, each becoming its own hyphen.
	// Using \s+ instead of \s would collapse those to a single hyphen and
	// produce a different slug than GitHub renders — false positives.
}

function extractHeadings(content: string): Set<string> {
	const slugs = new Set<string>()
	for (const line of content.split('\n')) {
		const m = line.match(/^(#{1,6})\s+(.*)/)
		if (!m) continue
		const slug = slugify(m[2]!.trim())
		if (slug) slugs.add(slug)
	}
	return slugs
}

// --- Main check --------------------------------------------------------------

interface BrokenLink {
	file: string
	line: number
	target: string
	reason: string
}

const broken: BrokenLink[] = []
const fileCache = new Map<string, string | null>() // path → content (or null if missing)

function getFileContent(absPath: string): string | null {
	if (fileCache.has(absPath)) return fileCache.get(absPath)!
	let content: string | null = null
	if (existsSync(absPath)) content = readFileSync(absPath, 'utf8')
	fileCache.set(absPath, content)
	return content
}

let checked = 0

for (const filePath of scanFiles) {
	const relFile = filePath.slice(ROOT.length + 1)
	const lines = readFileSync(filePath, 'utf8').split('\n')

	lines.forEach((line, i) => {
		let m: RegExpExecArray | null
		LINK_RE.lastIndex = 0
		while ((m = LINK_RE.exec(line)) !== null) {
			// m[3] is the link target for text links (m[1] would be image target — skipped)
			if (m[3] === undefined) continue
			const target = m[3].trim()

			// Skip external links
			if (/^[a-z]+:\/\//i.test(target) || target.startsWith('mailto:')) continue

			checked++

			let fragment = ''
			let pathPart = target
			const hashIdx = target.indexOf('#')
			if (hashIdx !== -1) {
				pathPart = target.slice(0, hashIdx)
				fragment = target.slice(hashIdx + 1)
			}

			// Resolve target file
			let targetFile: string
			if (pathPart === '') {
				// Same-document anchor link (#fragment)
				targetFile = filePath
			} else {
				targetFile = resolve(dirname(filePath), pathPart)
			}

			// If no fragment, just check file existence
			if (!fragment) {
				if (!existsSync(targetFile)) {
					broken.push({ file: relFile, line: i + 1, target, reason: 'file not found' })
				}
				continue
			}

			const content = getFileContent(targetFile)
			if (content === null) {
				broken.push({ file: relFile, line: i + 1, target, reason: 'file not found' })
				continue
			}

			// Check fragment against headings (or anchor tags as fallback)
			const headings = extractHeadings(content)
			// Also support explicit <a name="..."> or <a id="..."> anchors
			const explicitAnchors = new Set<string>()
			const anchorRe = /<a\s+(?:name|id)\s*=\s*["']([^"']+)["']/gi
			let am: RegExpExecArray | null
			while ((am = anchorRe.exec(content)) !== null) {
				explicitAnchors.add(am[1]!)
			}
			// Decode percent-encoding in fragment for comparison
			const decodedFragment = decodeURIComponent(fragment)
			if (!headings.has(fragment) && !headings.has(decodedFragment) && !explicitAnchors.has(fragment)) {
				broken.push({ file: relFile, line: i + 1, target, reason: `anchor "#${fragment}" not found` })
			}
		}
	})
}

// --- Report ------------------------------------------------------------------

if (broken.length > 0) {
	console.error(`\n❌ ${broken.length} broken link(s) found (checked ${checked} internal links):\n`)
	for (const b of broken) {
		console.error(`  ${b.file}:${b.line} → ${b.target}  (${b.reason})`)
	}
	console.error('')
	process.exit(1)
} else {
	console.log(`✅ All ${checked} internal links resolve.`)
	process.exit(0)
}
