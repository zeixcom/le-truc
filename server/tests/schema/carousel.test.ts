/**
 * Unit Tests for schema/carousel.markdoc.ts — Carousel Schema
 *
 * Tests for the carousel Markdoc schema transformation including
 * element name, slide extraction, prev/next navigation buttons,
 * tablist structure, and error handling for invalid input.
 */

import { describe, expect, test } from 'bun:test'
import { Node, Tag } from '@markdoc/markdoc'
import carousel from '../../schema/carousel.markdoc'

/* === Helpers === */

function makeSlide(title: string, children: Node[] = []): Node {
	return new Node('tag', { title }, children, 'slide')
}

function transformCarousel(slides: Node[], extraAttrs: Record<string, unknown> = {}): Tag {
	const node = new Node('tag', extraAttrs, slides, 'carousel')
	return carousel.transform!(node, {}) as Tag
}

/* === §11.7 Carousel schema === */

describe('carousel schema', () => {
	test('renders "module-carousel" element', () => {
		const result = transformCarousel([makeSlide('Slide One')])
		expect(result).toBeInstanceOf(Tag)
		expect(result.name).toBe('module-carousel')
	})

	test('creates prev/next navigation buttons', () => {
		const result = transformCarousel([makeSlide('Slide One')])
		// Find nav > buttons
		const nav = result.children.find(
			c => c instanceof Tag && (c as Tag).name === 'nav',
		) as Tag | undefined
		expect(nav).toBeTruthy()
		const buttons = (nav!.children as Tag[]).filter(
			c => c instanceof Tag && c.name === 'button',
		)
		const classes = buttons.map(b => b.attributes.class as string)
		expect(classes.some(c => c?.includes('prev'))).toBe(true)
		expect(classes.some(c => c?.includes('next'))).toBe(true)
	})

	test('wraps tab buttons in role="tablist"', () => {
		const result = transformCarousel([makeSlide('Slide One'), makeSlide('Slide Two')])
		const nav = result.children.find(
			c => c instanceof Tag && (c as Tag).name === 'nav',
		) as Tag | undefined
		expect(nav).toBeTruthy()
		const tablist = (nav!.children as Tag[]).find(
			c => c instanceof Tag && (c as Tag).attributes.role === 'tablist',
		)
		expect(tablist).toBeTruthy()
	})

	test('includes a tabpanel div for each slide', () => {
		const result = transformCarousel([makeSlide('Slide One'), makeSlide('Slide Two')])
		const slidesDiv = result.children.find(
			c => c instanceof Tag && (c as Tag).attributes.class === 'slides',
		) as Tag | undefined
		expect(slidesDiv).toBeTruthy()
		const panels = (slidesDiv!.children as Tag[]).filter(
			c => c instanceof Tag && (c as Tag).attributes.role === 'tabpanel',
		)
		expect(panels.length).toBe(2)
	})

	test('first slide has aria-current="true"', () => {
		const result = transformCarousel([makeSlide('First'), makeSlide('Second')])
		const slidesDiv = result.children.find(
			c => c instanceof Tag && (c as Tag).attributes.class === 'slides',
		) as Tag
		const firstSlide = slidesDiv.children[0] as Tag
		expect(firstSlide.attributes['aria-current']).toBe('true')
	})

	test('includes visually-hidden heading for accessibility', () => {
		const result = transformCarousel([makeSlide('Slide One')])
		const hiddenHeading = (result.children as Tag[]).find(
			c => c instanceof Tag && (c as Tag).attributes.class === 'visually-hidden',
		)
		expect(hiddenHeading).toBeTruthy()
	})

	test('throws when no slides provided', () => {
		expect(() => transformCarousel([])).toThrow('at least one slide')
	})

	test('throws when slide has no title', () => {
		const slideNoTitle = new Node('tag', {}, [], 'slide')
		expect(() => transformCarousel([slideNoTitle])).toThrow('title')
	})
})
