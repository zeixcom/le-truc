/**
 * Unit Tests for schema/callout.markdoc.ts — Callout Schema
 *
 * Tests for the callout Markdoc schema transformation including
 * element name, class validation/defaults, and child rendering.
 */

import { describe, expect, test } from 'bun:test'
import Markdoc, { Node, Tag } from '@markdoc/markdoc'
import callout from '../../schema/callout.markdoc'
import { CalloutClassAttribute } from '../../markdoc-constants'

/* === Helpers === */

const config = { tags: { callout } }

function transformCallout(attrs: Record<string, unknown>, children: Node[] = []): Tag {
	const node = new Node('tag', attrs, children, 'callout')
	return Markdoc.transform(node, config) as Tag
}

/* === §11.3 Callout schema — core transformation === */

describe('callout schema', () => {
	test('renders "card-callout" element', () => {
		const result = transformCallout({ class: 'info' })
		expect(result).toBeInstanceOf(Tag)
		expect(result.name).toBe('card-callout')
	})

	test('passes class attribute through', () => {
		const result = transformCallout({ class: 'danger' })
		expect(result.attributes.class).toBe('danger')
	})

	test('defaults class to "info" when omitted', () => {
		const result = transformCallout({})
		expect(result.attributes.class).toBe('info')
	})

	test('renders children inside callout', () => {
		const child = new Node('paragraph', {}, [
			new Node('text', { content: 'Note content' }),
		])
		const result = transformCallout({ class: 'note' }, [child])
		expect(result.children.length).toBeGreaterThan(0)
	})

	test('accepts all valid class values without error', () => {
		const validClasses = ['info', 'tip', 'danger', 'note', 'caution']
		for (const cls of validClasses) {
			const result = transformCallout({ class: cls })
			expect(result).toBeInstanceOf(Tag)
			expect(result.name).toBe('card-callout')
		}
	})
})

/* === CalloutClassAttribute validation === */

describe('CalloutClassAttribute', () => {
	const attr = new CalloutClassAttribute()

	test('accepts "info"', () => {
		expect(attr.validate('info')).toHaveLength(0)
	})

	test('accepts "tip"', () => {
		expect(attr.validate('tip')).toHaveLength(0)
	})

	test('accepts "danger"', () => {
		expect(attr.validate('danger')).toHaveLength(0)
	})

	test('accepts "note"', () => {
		expect(attr.validate('note')).toHaveLength(0)
	})

	test('accepts "caution"', () => {
		expect(attr.validate('caution')).toHaveLength(0)
	})

	test('rejects invalid class', () => {
		const errors = attr.validate('invalid')
		expect(errors.length).toBeGreaterThan(0)
		expect(errors[0].message).toContain('info')
	})

	test('rejects empty string', () => {
		const errors = attr.validate('')
		expect(errors.length).toBeGreaterThan(0)
	})
})
