/**
 * Unit Tests for effects/md-mirror.ts — Tag Stripping and Frontmatter Serialization
 */

import { describe, expect, test } from 'bun:test'
import { serializeFrontmatter, stripMarkdocTags } from '../../effects/md-mirror'

/* === stripMarkdocTags === */

describe('stripMarkdocTags — tabs/tab', () => {
	test('converts tab with title to ### heading', () => {
		const input = `{% tab title="NPM" %}\n\`\`\`sh\nnpm install\n\`\`\`\n{% /tab %}`
		const result = stripMarkdocTags(input)
		expect(result).toContain('### NPM')
		expect(result).toContain('npm install')
		expect(result).not.toContain('{%')
	})

	test('converts bare tab to --- separator', () => {
		const input = `{% tab %}\nSome content\n{% /tab %}`
		const result = stripMarkdocTags(input)
		expect(result).toContain('---')
		expect(result).toContain('Some content')
		expect(result).not.toContain('{%')
	})

	test('strips tabs container, preserving processed children', () => {
		const input = `{% tabs %}\n{% tab title="A" %}\nContent A\n{% /tab %}\n{% /tabs %}`
		const result = stripMarkdocTags(input)
		expect(result).toContain('### A')
		expect(result).toContain('Content A')
		expect(result).not.toContain('{% tabs %}')
		expect(result).not.toContain('{% /tabs %}')
	})

	test('strips tabgroup container', () => {
		const input = `{% tabgroup %}\n#### NPM\n\`\`\`sh\nnpm i\n\`\`\`\n{% /tabgroup %}`
		const result = stripMarkdocTags(input)
		expect(result).toContain('#### NPM')
		expect(result).toContain('npm i')
		expect(result).not.toContain('{% tabgroup %}')
		expect(result).not.toContain('{% /tabgroup %}')
	})
})

describe('stripMarkdocTags — callout', () => {
	test('converts callout with title to labelled blockquote', () => {
		const input = `{% callout .tip title="Important Note" %}\nRead this carefully.\n{% /callout %}`
		const result = stripMarkdocTags(input)
		expect(result).toContain('> **Important Note:** Read this carefully.')
		expect(result).not.toContain('{%')
	})

	test('uses class name as label when no title attribute', () => {
		const input = `{% callout .warning %}\nWatch out!\n{% /callout %}`
		const result = stripMarkdocTags(input)
		expect(result).toContain('> **warning:** Watch out!')
		expect(result).not.toContain('{%')
	})

	test('prefixes each line of multi-line body with >', () => {
		const input = `{% callout .tip title="T" %}\nLine 1\nLine 2\n{% /callout %}`
		const result = stripMarkdocTags(input)
		expect(result).toContain('> **T:** Line 1')
		expect(result).toContain('> Line 2')
	})

	test('handles empty lines in callout body', () => {
		const input = `{% callout .note title="N" %}\nFirst para.\n\nSecond para.\n{% /callout %}`
		const result = stripMarkdocTags(input)
		expect(result).toContain('> **N:** First para.')
		expect(result).toContain('>')
		expect(result).toContain('> Second para.')
	})

	test('title attribute takes precedence over class name', () => {
		const input = `{% callout .warning title="Custom Title" %}\nContent\n{% /callout %}`
		const result = stripMarkdocTags(input)
		expect(result).toContain('> **Custom Title:** Content')
		expect(result).not.toContain('warning')
	})
})

describe('stripMarkdocTags — container strip tags', () => {
	test.each([
		'hero',
		'section',
		'carousel',
		'slide',
		'demo',
		'listnav',
		'blogpost',
	])('strips %s open/close tags, keeps content', tag => {
		const input = `{%  ${tag} %}\nSome content\n{% /${tag} %}`
		const result = stripMarkdocTags(input)
		expect(result).toContain('Some content')
		expect(result).not.toContain(`{% ${tag}`)
		expect(result).not.toContain(`{% /${tag} %}`)
	})

	test('strips section with class attribute', () => {
		const input = `{% section .breakout %}\nContent here\n{% /section %}`
		const result = stripMarkdocTags(input)
		expect(result).toContain('Content here')
		expect(result).not.toContain('{%')
	})

	test('strips slide with title and class attributes', () => {
		const input = `{% slide title="Hello" class="purple" %}\nSlide content\n{% /slide %}`
		const result = stripMarkdocTags(input)
		expect(result).toContain('Slide content')
		expect(result).not.toContain('{%')
	})
})

describe('stripMarkdocTags — self-closing tags', () => {
	test('strips blogmeta self-closing tag', () => {
		const input = `Before\n{% blogmeta %}\nAfter`
		const result = stripMarkdocTags(input)
		expect(result).toContain('Before')
		expect(result).toContain('After')
		expect(result).not.toContain('{%')
	})

	test('strips blogmeta with explicit self-closing slash', () => {
		const input = `{% blogmeta /%}`
		const result = stripMarkdocTags(input)
		expect(result).toBe('')
	})
})

describe('stripMarkdocTags — blank line normalization', () => {
	test('collapses 3+ consecutive blank lines to 2', () => {
		const input = `A\n\n\n\n\nB`
		const result = stripMarkdocTags(input)
		expect(result).toBe('A\n\nB')
	})

	test('trims leading and trailing whitespace', () => {
		const input = `\n\nContent\n\n`
		expect(stripMarkdocTags(input)).toBe('Content')
	})
})

describe('stripMarkdocTags — passthrough', () => {
	test('leaves standard Markdown untouched', () => {
		const input = `# Heading\n\nParagraph with **bold** and _italic_.\n\n- item 1\n- item 2`
		expect(stripMarkdocTags(input)).toBe(input)
	})

	test('leaves fenced code blocks untouched', () => {
		const input = '```js\nconst x = 1\n```'
		expect(stripMarkdocTags(input)).toBe(input)
	})
})

describe('stripMarkdocTags — realistic page fragment', () => {
	test('transforms getting-started-style content', () => {
		const input = `{% hero %}\n# Getting Started\n\nIntro text.\n{% /hero %}\n\n{% section %}\n## Install\n\n{% callout .tip title="Tip" %}\nUse a CDN for zero build tools.\n{% /callout %}\n\n{% /section %}`
		const result = stripMarkdocTags(input)
		expect(result).toContain('# Getting Started')
		expect(result).toContain('## Install')
		expect(result).toContain('> **Tip:** Use a CDN for zero build tools.')
		expect(result).not.toContain('{%')
	})
})

/* === serializeFrontmatter === */

describe('serializeFrontmatter', () => {
	test('returns empty string for empty metadata', () => {
		expect(serializeFrontmatter({})).toBe('')
	})

	test('includes title in output', () => {
		const result = serializeFrontmatter({ title: 'Getting Started' })
		expect(result).toContain('title: "Getting Started"')
		expect(result).toStartWith('---\n')
		expect(result).toEndWith('---\n\n')
	})

	test('includes description when present', () => {
		const result = serializeFrontmatter({
			title: 'T',
			description: 'A short description',
		})
		expect(result).toContain('description: "A short description"')
	})

	test('includes emoji when present', () => {
		const result = serializeFrontmatter({ title: 'T', emoji: '🚀' })
		expect(result).toContain('emoji: "🚀"')
	})

	test('includes date without quotes', () => {
		const result = serializeFrontmatter({ title: 'T', date: '2026-03-09' })
		expect(result).toContain('date: 2026-03-09')
	})

	test('includes tags as comma-separated list', () => {
		const result = serializeFrontmatter({ title: 'T', tags: ['a', 'b', 'c'] })
		expect(result).toContain('tags: a, b, c')
	})

	test('omits undefined fields', () => {
		const result = serializeFrontmatter({ title: 'T' })
		expect(result).not.toContain('description')
		expect(result).not.toContain('emoji')
		expect(result).not.toContain('tags')
	})

	test('JSON-escapes special characters in title', () => {
		const result = serializeFrontmatter({ title: 'It\'s a "test"' })
		expect(result).toContain('"It\'s a \\"test\\""')
	})
})
