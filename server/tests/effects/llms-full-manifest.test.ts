/**
 * Unit Tests for effects/llms-full-manifest.ts — llms-full.txt Generation
 */

import { describe, expect, test } from 'bun:test'
import {
	generateLlmsFullTxt,
	type PageContent,
} from '../../effects/llms-full-manifest'

/* === Helpers === */

function makePage(relativePath: string, content: string): PageContent {
	return { relativePath, content }
}

const baseParams = {
	readme: '# Le Truc\n\nREADME body.',
	architecture: '# Architecture\n\nArchitecture body.',
	agents: '# Agent Context\n\nAgents body.',
}

/* === Header === */

describe('generateLlmsFullTxt — header', () => {
	test('starts with the canonical title', () => {
		const result = generateLlmsFullTxt({ pages: [], ...baseParams })
		expect(result).toStartWith('# Le Truc — Full Documentation\n')
	})

	test('includes the tagline blockquote', () => {
		const result = generateLlmsFullTxt({ pages: [], ...baseParams })
		expect(result).toContain(
			'> Type-safe reactive Web Components — HTML-first, backend-agnostic.',
		)
	})

	test('notes it is auto-generated authoritative reference', () => {
		const result = generateLlmsFullTxt({ pages: [], ...baseParams })
		expect(result).toContain('Auto-generated')
		expect(result).toContain('surprising behaviors')
	})

	test('ends with a newline', () => {
		const result = generateLlmsFullTxt({ pages: [], ...baseParams })
		expect(result).toEndWith('\n')
	})
})

/* === Section ordering === */

describe('generateLlmsFullTxt — section order', () => {
	test('README precedes narrative pages', () => {
		const pages = [makePage('index.md', 'Intro body.')]
		const result = generateLlmsFullTxt({ pages, ...baseParams })
		expect(result.indexOf('# Le Truc\n\nREADME body.')).toBeLessThan(
			result.indexOf('# Introduction'),
		)
	})

	test('narrative pages follow curated order regardless of input order', () => {
		const pages = [
			makePage('data-flow.md', 'Data Flow body.'),
			makePage('index.md', 'Intro body.'),
			makePage('components.md', 'Components body.'),
			makePage('getting-started.md', 'Getting Started body.'),
			makePage('styling.md', 'Styling body.'),
		]
		const result = generateLlmsFullTxt({ pages, ...baseParams })
		expect(result.indexOf('# Introduction')).toBeLessThan(
			result.indexOf('# Getting Started'),
		)
		expect(result.indexOf('# Getting Started')).toBeLessThan(
			result.indexOf('# Components'),
		)
		expect(result.indexOf('# Components')).toBeLessThan(
			result.indexOf('# Styling'),
		)
		expect(result.indexOf('# Styling')).toBeLessThan(
			result.indexOf('# Data Flow'),
		)
	})

	test('ARCHITECTURE and AGENTS come after narrative pages', () => {
		const pages = [makePage('data-flow.md', 'Data Flow body.')]
		const result = generateLlmsFullTxt({ pages, ...baseParams })
		expect(result.indexOf('# Data Flow')).toBeLessThan(
			result.indexOf('# Architecture'),
		)
		expect(result.indexOf('# Architecture')).toBeLessThan(
			result.indexOf('# Agent Context — Le Truc'),
		)
	})
})

/* === Curated filtering === */

describe('generateLlmsFullTxt — curated filtering', () => {
	test('excludes non-curated top-level pages (about, examples)', () => {
		const pages = [
			makePage('index.md', 'Intro body.'),
			makePage('about.md', 'About body.'),
			makePage('examples.md', 'Examples body.'),
		]
		const result = generateLlmsFullTxt({ pages, ...baseParams })
		expect(result).toContain('# Introduction')
		expect(result).not.toContain('About body.')
		expect(result).not.toContain('Examples body.')
	})

	test('excludes blog posts', () => {
		const pages = [
			makePage('index.md', 'Intro body.'),
			makePage('blog/some-post.md', 'Blog post body.'),
		]
		const result = generateLlmsFullTxt({ pages, ...baseParams })
		expect(result).not.toContain('Blog post body.')
	})

	test('missing curated pages are silently skipped', () => {
		// Only index present; components/styling/data-flow/getting-started absent
		const pages = [makePage('index.md', 'Intro body.')]
		const result = generateLlmsFullTxt({ pages, ...baseParams })
		expect(result).toContain('# Introduction')
		expect(result).not.toContain('# Getting Started')
		expect(result).not.toContain('# Components')
	})
})

/* === Markdoc stripping === */

describe('generateLlmsFullTxt — Markdoc stripping', () => {
	test('strips Markdoc tags from narrative pages', () => {
		const pages = [
			makePage(
				'index.md',
				'{% section %}\n## Hello\n\n{% callout .tip title="Note" %}\nTip body.\n{% /callout %}\n{% /section %}',
			),
		]
		const result = generateLlmsFullTxt({ pages, ...baseParams })
		expect(result).not.toContain('{% section')
		expect(result).not.toContain('{% callout')
		expect(result).toContain('## Hello')
		expect(result).toContain('**Note:**')
	})

	test('strips self-closing Markdoc tags (e.g. sources)', () => {
		// {% sources src="..." /%} loads content at runtime and has no inline
		// text — it must be dropped entirely, not left as a stray tag.
		const pages = [
			makePage(
				'index.md',
				'Intro.\n\n{% sources title="Source" src="./sources/foo.html" /%}\n\nMore.',
			),
		]
		const result = generateLlmsFullTxt({ pages, ...baseParams })
		expect(result).not.toContain('{% sources')
		expect(result).toContain('Intro.')
		expect(result).toContain('More.')
	})

	test('does not strip content from standalone docs', () => {
		// README/ARCHITECTURE/AGENTS are plain markdown and pass through verbatim.
		const result = generateLlmsFullTxt({
			pages: [],
			readme: 'Raw README with `{{ literal }}` braces.',
			architecture: '# Architecture\n\nBody.',
			agents: '# Agent Context\n\nBody.',
		})
		expect(result).toContain('Raw README with `{{ literal }}` braces.')
	})
})

/* === Format === */

describe('generateLlmsFullTxt — format', () => {
	test('sections separated by horizontal rule', () => {
		const result = generateLlmsFullTxt({ pages: [], ...baseParams })
		// README section and ARCHITECTURE section must have a `---` between them
		expect(result).toContain('\n---\n\n# Architecture')
	})

	test('each section body is trimmed', () => {
		const pages = [makePage('index.md', '\n\n  Intro body.  \n\n')]
		const result = generateLlmsFullTxt({ pages, ...baseParams })
		expect(result).toContain('# Introduction\n\nIntro body.\n')
	})

	test('drops a leading body H1 that duplicates the section title (with emoji)', () => {
		// Narrative pages author their own emoji H1 inside {% hero %}; after
		// stripping, it must not produce a duplicate H1 under the section header.
		const pages = [makePage('index.md', '# 📖 Introduction\n\nBody text.')]
		const result = generateLlmsFullTxt({ pages, ...baseParams })
		expect(result.match(/# Introduction/g)?.length).toBe(1)
		expect(result).toContain('# Introduction\n\nBody text.')
	})

	test('drops a leading body H1 that exactly matches the section title', () => {
		// README.md starts with `# Le Truc`, which equals the section title.
		const result = generateLlmsFullTxt({
			pages: [],
			readme: '# Le Truc\n\nREADME body.',
			architecture: '# Architecture\n\nArchitecture body.',
			agents: '# Agent Context — Le Truc\n\nAgents body.',
		})
		// The document's own `# Le Truc — Full Documentation` header is line 1;
		// the README section header is the only other `# Le Truc\n` occurrence.
		expect(result.match(/^# Le Truc$/m)?.length).toBe(1)
		expect(result).toContain('# Le Truc\n\nREADME body.')
	})

	test('preserves a leading body H1 that does not match the section title', () => {
		const pages = [makePage('index.md', '# Something Else\n\nBody text.')]
		const result = generateLlmsFullTxt({ pages, ...baseParams })
		expect(result).toContain('# Introduction')
		expect(result).toContain('# Something Else')
	})
})
