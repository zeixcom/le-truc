/**
 * Unit Tests for templates/chapter-nav.ts — Chapter Stepper
 *
 * Pure function tests over mock chapter data — no I/O required.
 */

import { describe, expect, test } from 'bun:test'
import { chapterNav } from '../../templates/chapter-nav'

/* === chapterNav === */

describe('chapterNav', () => {
	test('renders part position and total', () => {
		const result = chapterNav(
			'Building Components',
			2,
			4,
			{ url: 'components.html', title: 'Components' },
			{ url: 'extensions.html', title: 'Extensions' },
		)
		expect(result).toContain('Building Components')
		expect(result).toContain('Part 2 of 4')
	})

	test('renders prev and next links with rel attributes', () => {
		const result = chapterNav(
			'Building Components',
			2,
			4,
			{ url: 'components.html', title: 'Components' },
			{ url: 'extensions.html', title: 'Extensions' },
		)
		expect(result).toContain('rel="prev"')
		expect(result).toContain('href="components.html"')
		expect(result).toContain('rel="next"')
		expect(result).toContain('href="extensions.html"')
	})

	test('omits the prev link for the first part', () => {
		const result = chapterNav('Building Components', 1, 4, undefined, {
			url: 'props.html',
			title: 'Props & State',
		})
		expect(result).not.toContain('rel="prev"')
		expect(result).toContain('rel="next"')
	})

	test('omits the next link for the last part', () => {
		const result = chapterNav(
			'Building Components',
			4,
			4,
			{ url: 'effects.html', title: 'Events & Effects' },
			undefined,
		)
		expect(result).toContain('rel="prev"')
		expect(result).not.toContain('rel="next"')
	})

	test('returns empty string when both links are missing', () => {
		expect(chapterNav('Building Components', 1, 4)).toBe('')
	})

	test('escapes HTML in titles', () => {
		const result = chapterNav('Chapter', 1, 2, undefined, {
			url: 'next.html',
			title: 'A & B',
		})
		expect(result).toContain('A &amp; B')
		expect(result).not.toContain('A & B')
	})
})
