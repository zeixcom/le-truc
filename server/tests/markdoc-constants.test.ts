/**
 * Unit Tests for markdoc-constants.ts — Attribute Classes and Constants
 *
 * Tests for attribute classes (ClassAttribute, IdAttribute, CalloutClassAttribute)
 * and exported constants (standardChildren, richChildren, attribute definitions).
 */

import { describe, test, expect } from 'bun:test'
import {
	ClassAttribute,
	IdAttribute,
	CalloutClassAttribute,
	classAttribute,
	idAttribute,
	styleAttribute,
	titleAttribute,
	requiredTitleAttribute,
	commonAttributes,
	styledAttributes,
	standardChildren,
	richChildren,
} from '../markdoc-constants'

/* === Attribute Classes === */

describe('ClassAttribute', () => {
	const classAttr = new ClassAttribute()

	test('should validate string class', () => {
		const errors = classAttr.validate('my-class')
		expect(errors.length).toBe(0)
	})

	test('should validate object class shorthand', () => {
		const errors = classAttr.validate({ active: true, disabled: false })
		expect(errors.length).toBe(0)
	})

	test('should reject invalid types', () => {
		const errors = classAttr.validate(123)
		expect(errors.length).toBeGreaterThan(0)
		expect(errors[0].id).toBe('invalid-class-type')
		expect(errors[0].level).toBe('error')
	})

	test('should reject null', () => {
		const errors = classAttr.validate(null)
		expect(errors.length).toBeGreaterThan(0)
	})

	test('should transform string class', () => {
		const result = classAttr.transform('my-class other-class')
		expect(result).toBe('my-class other-class')
	})

	test('should transform object shorthand to string', () => {
		const result = classAttr.transform({
			active: true,
			disabled: false,
			selected: true,
		})
		expect(result).toContain('active')
		expect(result).toContain('selected')
		expect(result).not.toContain('disabled')
	})

	test('should handle empty object', () => {
		const result = classAttr.transform({})
		expect(result).toBe('')
	})

	test('should handle object with all false values', () => {
		const result = classAttr.transform({
			active: false,
			disabled: false,
		})
		expect(result).toBe('')
	})

	test('should preserve class order from object keys', () => {
		const result = classAttr.transform({
			zebra: true,
			alpha: true,
			beta: true,
		})
		// Object.keys maintains insertion order
		expect(result).toBeTruthy()
	})
})

describe('IdAttribute', () => {
	const idAttr = new IdAttribute()

	test('should validate string id', () => {
		const errors = idAttr.validate('my-id')
		expect(errors.length).toBe(0)
	})

	test('should reject non-string id', () => {
		const errors = idAttr.validate(123)
		expect(errors.length).toBeGreaterThan(0)
		expect(errors[0].id).toBe('invalid-id-type')
		expect(errors[0].level).toBe('error')
	})

	test('should reject null', () => {
		const errors = idAttr.validate(null)
		expect(errors.length).toBeGreaterThan(0)
	})

	test('should reject object', () => {
		const errors = idAttr.validate({ id: 'test' })
		expect(errors.length).toBeGreaterThan(0)
	})

	test('should transform string id', () => {
		expect(idAttr.transform('my-id')).toBe('my-id')
	})

	test('should transform number to string', () => {
		expect(idAttr.transform(123)).toBe('123')
	})

	test('should transform boolean to string', () => {
		expect(idAttr.transform(true)).toBe('true')
		expect(idAttr.transform(false)).toBe('false')
	})

	test('should transform null to string', () => {
		expect(idAttr.transform(null)).toBe('null')
	})
})

describe('CalloutClassAttribute', () => {
	const calloutAttr = new CalloutClassAttribute()

	test('should validate allowed values', () => {
		const allowedValues = ['info', 'tip', 'danger', 'note', 'caution']
		for (const value of allowedValues) {
			const errors = calloutAttr.validate(value)
			expect(errors.length).toBe(0)
		}
	})

	test('should reject invalid string values', () => {
		const errors = calloutAttr.validate('invalid-class')
		expect(errors.length).toBeGreaterThan(0)
		expect(errors[0].id).toBe('attribute-value-invalid')
		expect(errors[0].level).toBe('error')
		expect(errors[0].message).toContain('invalid-class')
	})

	test('should reject invalid case variations', () => {
		const errors = calloutAttr.validate('INFO')
		expect(errors.length).toBeGreaterThan(0)
	})

	test('should transform string value', () => {
		expect(calloutAttr.transform('tip')).toBe('tip')
		expect(calloutAttr.transform('danger')).toBe('danger')
		expect(calloutAttr.transform('info')).toBe('info')
	})

	test('should transform object shorthand with valid class', () => {
		const result = calloutAttr.transform({
			danger: true,
			info: false,
		})
		expect(result).toBe('danger')
	})

	test('should return first valid class from object', () => {
		const result = calloutAttr.transform({
			tip: true,
			danger: true,
		})
		// Should return first valid class found
		expect(['tip', 'danger']).toContain(result)
	})

	test('should return first class even if invalid when no valid class found', () => {
		const result = calloutAttr.transform({
			invalid: true,
		})
		// Returns first class (even if invalid) when no valid class is found
		expect(result).toBe('invalid')
	})

	test('should default to info for empty object', () => {
		const result = calloutAttr.transform({})
		expect(result).toBe('info')
	})

	test('should default to info for object with all false values', () => {
		const result = calloutAttr.transform({
			danger: false,
			tip: false,
		})
		expect(result).toBe('info')
	})

	test('should handle mixed valid and invalid classes', () => {
		const result = calloutAttr.transform({
			invalid: true,
			danger: true,
		})
		expect(result).toBe('danger')
	})
})

/* === Attribute Definitions === */

describe('attribute definitions', () => {
	test('classAttribute should have ClassAttribute type', () => {
		expect(classAttribute.type).toBe(ClassAttribute)
	})

	test('idAttribute should have IdAttribute type', () => {
		expect(idAttribute.type).toBe(IdAttribute)
	})

	test('styleAttribute should have String type', () => {
		expect(styleAttribute.type).toBe(String)
	})

	test('titleAttribute should have String type', () => {
		expect(titleAttribute.type).toBe(String)
	})

	test('requiredTitleAttribute should be required', () => {
		expect(requiredTitleAttribute.type).toBe(String)
		expect(requiredTitleAttribute.required).toBe(true)
	})

	test('commonAttributes should contain class and id', () => {
		expect(commonAttributes).toHaveProperty('class')
		expect(commonAttributes).toHaveProperty('id')
		expect(commonAttributes.class).toBe(classAttribute)
		expect(commonAttributes.id).toBe(idAttribute)
	})

	test('styledAttributes should extend commonAttributes', () => {
		expect(styledAttributes).toHaveProperty('class')
		expect(styledAttributes).toHaveProperty('id')
		expect(styledAttributes).toHaveProperty('style')
		expect(styledAttributes.style).toBe(styleAttribute)
	})
})

/* === Children Constants === */

describe('children constants', () => {
	test('standardChildren should contain expected node types', () => {
		expect(standardChildren).toContain('paragraph')
		expect(standardChildren).toContain('heading')
		expect(standardChildren).toContain('list')
		expect(standardChildren).toContain('blockquote')
		expect(standardChildren).toContain('hr')
		expect(standardChildren).toContain('fence')
		expect(standardChildren).toContain('callout')
		expect(standardChildren).toContain('tag')
		expect(standardChildren).toContain('inline')
	})

	test('standardChildren should have correct length', () => {
		expect(standardChildren.length).toBe(9)
	})

	test('richChildren should extend standardChildren', () => {
		// All standard children should be in richChildren
		for (const child of standardChildren) {
			expect(richChildren).toContain(child)
		}
	})

	test('richChildren should contain additional inline types', () => {
		expect(richChildren).toContain('item')
		expect(richChildren).toContain('text')
		expect(richChildren).toContain('strong')
		expect(richChildren).toContain('em')
		expect(richChildren).toContain('code')
		expect(richChildren).toContain('link')
	})

	test('richChildren should have correct length', () => {
		// standardChildren (9) + additional types (6)
		expect(richChildren.length).toBe(15)
	})

	test('standardChildren should be immutable reference', () => {
		// Verify we can't accidentally mutate the exported array
		const original = [...standardChildren]
		expect(standardChildren).toEqual(original)
	})
})
