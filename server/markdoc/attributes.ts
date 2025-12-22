import type { ValidationError } from '@markdoc/markdoc'

/**
 * Custom attribute type for class that handles both string and shorthand syntax
 * Converts shorthand object like { "class1": true, "class2": true } to "class1 class2"
 */
export class ClassAttribute {
	validate(value: any): ValidationError[] {
		// Accept both string and object (shorthand) formats
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
		// Convert shorthand object to space-separated string
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
		// ID should always be a string
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
 * Custom attribute type for callout class that handles shorthand syntax
 * and validates against allowed values
 */
export class CalloutClassAttribute {
	private allowedValues = ['info', 'tip', 'danger', 'note', 'caution']

	validate(value: any): ValidationError[] {
		// Convert shorthand to string first
		const stringValue = this.transform(value)

		// Check if the resulting string is in allowed values
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
		// Convert shorthand object to string, then validate
		if (typeof value === 'string') return value
		if (typeof value === 'object' && value !== null) {
			const classes = Object.keys(value).filter(key => value[key])
			// For callout, we expect only one class, so take the first valid one
			const firstValidClass = classes.find(cls =>
				this.allowedValues.includes(cls),
			)
			return firstValidClass || classes[0] || 'info'
		}
		return 'info' // default fallback
	}
}

// Common attribute sets
export const COMMON_ATTRIBUTES = {
	class: {
		type: ClassAttribute,
	},
	id: {
		type: IdAttribute,
	},
	style: {
		type: String,
	},
}
