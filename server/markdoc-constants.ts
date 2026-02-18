/**
 * Markdoc Constants and Attribute Definitions
 *
 * Shared constants, attribute definitions, and attribute classes used by
 * Markdoc schemas. Extracted to avoid circular dependencies between
 * markdoc-helpers.ts and schema files.
 */

import type { ValidationError } from '@markdoc/markdoc'

/* === Attribute Classes === */

/**
 * Custom attribute type for class that handles both string and shorthand syntax
 * Converts shorthand object like { "class1": true, "class2": true } to "class1 class2"
 */
export class ClassAttribute {
	validate(value: any): ValidationError[] {
		if (typeof value === 'string') return []
		if (typeof value === 'object' && value !== null) return []
		return [
			{
				id: 'invalid-class-type',
				level: 'error' as const,
				message: 'Class must be a string or shorthand object',
			},
		]
	}

	transform(value: any): string {
		if (typeof value === 'string') return value
		if (typeof value === 'object' && value !== null) {
			return Object.keys(value)
				.filter(key => value[key])
				.join(' ')
		}
		return ''
	}
}

/**
 * Custom attribute type for id that ensures it's always a string
 */
export class IdAttribute {
	validate(value: any): ValidationError[] {
		if (typeof value === 'string') return []
		return [
			{
				id: 'invalid-id-type',
				level: 'error' as const,
				message: 'ID must be a string',
			},
		]
	}

	transform(value: any): string {
		return String(value)
	}
}

/**
 * Custom attribute type for callout class that validates against allowed values
 */
export class CalloutClassAttribute {
	private allowedValues = ['info', 'tip', 'danger', 'note', 'caution']

	validate(value: any): ValidationError[] {
		const stringValue = this.transform(value)
		if (!this.allowedValues.includes(stringValue)) {
			return [
				{
					id: 'attribute-value-invalid',
					level: 'error' as const,
					message: `Attribute 'class' must match one of ${JSON.stringify(this.allowedValues)}. Got '${stringValue}' instead.`,
				},
			]
		}
		return []
	}

	transform(value: any): string {
		if (typeof value === 'string') return value
		if (typeof value === 'object' && value !== null) {
			const classes = Object.keys(value).filter(key => value[key])
			const firstValidClass = classes.find(cls =>
				this.allowedValues.includes(cls),
			)
			return firstValidClass || classes[0] || 'info'
		}
		return 'info'
	}
}

/* === Attribute Definitions === */

export const classAttribute = {
	type: ClassAttribute,
}

export const idAttribute = {
	type: IdAttribute,
}

export const styleAttribute = {
	type: String,
}

export const titleAttribute = {
	type: String,
}

export const requiredTitleAttribute = {
	type: String,
	required: true,
}

// Common attribute sets
export const commonAttributes = {
	class: classAttribute,
	id: idAttribute,
}

export const styledAttributes = {
	...commonAttributes,
	style: styleAttribute,
}

/* === Children Constants === */

export const standardChildren = [
	'paragraph',
	'heading',
	'list',
	'blockquote',
	'hr',
	'fence',
	'callout',
	'tag',
	'inline',
]

export const richChildren = [
	...standardChildren,
	'item',
	'text',
	'strong',
	'em',
	'code',
	'link',
]
