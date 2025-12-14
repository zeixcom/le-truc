/**
 * Template Utilities
 *
 * Shared utilities for tagged template literals including escaping,
 * validation, and error handling functions.
 */

import {
	DEFAULT_RESOURCE_TYPE,
	DEVELOPMENT_CONFIG,
	ERROR_MESSAGES,
	MIN_HASH_LENGTHS,
	RESOURCE_TYPE_MAP,
	SELF_CLOSING_TAGS,
	VALIDATION_PATTERNS,
} from './constants'

// HTML template tag with automatic escaping
export function html(
	strings: TemplateStringsArray,
	...values: unknown[]
): string {
	return processTemplate(strings, values, 'html')
}

// XML template tag with automatic escaping
export function xml(
	strings: TemplateStringsArray,
	...values: unknown[]
): string {
	return processTemplate(strings, values, 'xml')
}

// CSS template tag (no escaping needed for CSS)
export function css(
	strings: TemplateStringsArray,
	...values: unknown[]
): string {
	return processTemplate(strings, values, 'css')
}

// JavaScript template tag for code generation
export function js(
	strings: TemplateStringsArray,
	...values: unknown[]
): string {
	return processTemplate(strings, values, 'js')
}

// Core template processing function
function processTemplate(
	strings: TemplateStringsArray,
	values: unknown[],
	type: 'html' | 'xml' | 'css' | 'js',
): string {
	let result = ''

	for (let i = 0; i < strings.length; i++) {
		result += strings[i]

		if (i < values.length) {
			const value = values[i]

			if (value === null || value === undefined) {
				continue
			} else if (Array.isArray(value)) {
				// Handle arrays based on template type
				if (type === 'js') {
					result += value
						.map(item =>
							typeof item === 'string' ? `'${item}'` : String(item),
						)
						.join(',\n\t')
				} else {
					result += value.join('')
				}
			} else if (typeof value === 'string') {
				// Add strings directly (assume they're already safe)
				result += value
			} else {
				// Convert other types to string and escape if needed
				const stringValue = String(value)
				if (type === 'html') {
					result += escapeHtml(stringValue)
				} else if (type === 'xml') {
					result += escapeXml(stringValue)
				} else {
					result += stringValue
				}
			}
		}
	}

	return result.trim()
}

// HTML escaping function
export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

// XML escaping function
export function escapeXml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;')
}

// Generate URL-friendly slug from text
export function generateSlug(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.trim()
}

// Common sorting utilities
export interface SortableItem {
	filename: string
}

export function createOrderedSort<T extends SortableItem>(
	order: string[],
): (a: T, b: T) => number {
	return (a, b) => {
		const aName = a.filename.replace('.html', '')
		const bName = b.filename.replace('.html', '')

		const aIndex = order.indexOf(aName)
		const bIndex = order.indexOf(bName)

		// If both items are in order, sort by their order
		if (aIndex !== -1 && bIndex !== -1) {
			return aIndex - bIndex
		}

		// If only one item is in order, prioritize it
		if (aIndex !== -1) return -1
		if (bIndex !== -1) return 1

		// If neither item is in order, sort alphabetically
		return aName.localeCompare(bName)
	}
}

// Common validation patterns
export function validateHashString(
	hash: string,
	minLength: number = MIN_HASH_LENGTHS.ASSET_HASH,
): boolean {
	return VALIDATION_PATTERNS.HEX_HASH.test(hash) && hash.length >= minLength
}

export function validateRequiredString(
	value: unknown,
	fieldName: string,
): string[] {
	const errors: string[] = []
	if (!value || typeof value !== 'string') {
		errors.push(ERROR_MESSAGES.MISSING_REQUIRED_FIELD(fieldName))
	}
	return errors
}

export function validateArrayField<T>(
	value: unknown,
	fieldName: string,
	validator?: (item: T) => boolean,
): string[] {
	const errors: string[] = []
	if (value !== undefined && !Array.isArray(value)) {
		errors.push(ERROR_MESSAGES.INVALID_TYPE(fieldName, 'array'))
	} else if (value && validator) {
		const invalidItems = (value as T[]).filter(item => !validator(item))
		if (invalidItems.length > 0) {
			errors.push(`${fieldName} contains invalid items`)
		}
	}
	return errors
}

// Error boundary wrapper for template functions
export function safeRender<T extends (...args: any[]) => string>(
	templateFn: T,
	fallback: string = '',
	onError?: (error: Error) => void,
): T {
	return ((...args: Parameters<T>) => {
		try {
			return templateFn(...args)
		} catch (error) {
			console.error('Template rendering error:', error)
			onError?.(error as Error)
			return fallback
		}
	}) as T
}

// Conditional rendering helper
export function when<T>(condition: boolean, template: () => T): T | '' {
	return condition ? template() : ('' as T | '')
}

// Inverse conditional rendering helper
export function unless<T>(condition: boolean, template: () => T): T | '' {
	return !condition ? template() : ('' as T | '')
}

// Safe array mapping with error handling
export function mapSafe<T, R>(
	items: T[],
	mapper: (item: T, index: number) => R,
	separator: string = '',
): string {
	try {
		return items.map(mapper).join(separator)
	} catch (error) {
		console.error('Template mapping error:', error)
		return ''
	}
}

// Template composition helper
export function fragment(...templates: string[]): string {
	return templates.filter(Boolean).join('')
}

// Indent template content
export function indent(template: string, spaces: number = 2): string {
	const indentation = ' '.repeat(spaces)
	return template
		.split('\n')
		.map(line => (line.trim() ? indentation + line : line))
		.join('\n')
}

// Minify HTML/XML by removing extra whitespace
export function minify(template: string): string {
	return template.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim()
}

// Basic template validation
export interface ValidationResult {
	valid: boolean
	errors: string[]
}

export function validateHtml(template: string): ValidationResult {
	const errors: string[] = []

	// Basic validation checks
	const openTags = template.match(/<[^/][^>]*>/g) || []
	const closeTags = template.match(/<\/[^>]*>/g) || []

	// Self-closing tags that don't need closing tags
	const selfClosingTags = SELF_CLOSING_TAGS

	// Check for unclosed tags (simplified check)
	const openTagNames = openTags
		.map(tag => tag.match(/<(\w+)/)?.[1])
		.filter(Boolean)
		.filter(tag => !selfClosingTags.includes(tag!))

	const closeTagNames = closeTags
		.map(tag => tag.match(/<\/(\w+)/)?.[1])
		.filter(Boolean)

	if (openTagNames.length !== closeTagNames.length) {
		errors.push('Mismatched opening and closing tags')
	}

	// Check for common HTML issues
	if (template.includes('< ')) {
		errors.push('Space after opening bracket detected')
	}

	if (template.includes(' >')) {
		errors.push('Space before closing bracket detected')
	}

	return { valid: errors.length === 0, errors }
}

export function validateXml(template: string): ValidationResult {
	const errors: string[] = []

	// Check for XML declaration
	if (!template.includes('<?xml')) {
		errors.push('Missing XML declaration')
	}

	// Check for proper encoding
	if (template.includes('<?xml') && !template.includes('encoding=')) {
		errors.push('Missing encoding declaration in XML')
	}

	// Basic tag matching (reuse HTML validation logic)
	const htmlValidation = validateHtml(template)
	errors.push(...htmlValidation.errors)

	return { valid: errors.length === 0, errors }
}

// Development helpers
export function debugTemplate(name: string, template: string): string {
	if (DEVELOPMENT_CONFIG.ENABLE_LOGGING) {
		console.log(
			`Template [${name}]:`,
			template.substring(0, DEVELOPMENT_CONFIG.MAX_TEMPLATE_LENGTH_FOR_LOGGING)
				+ '...',
		)
	}
	return template
}

// Performance measurement for template generation
export function measureTemplate<T extends (...args: any[]) => string>(
	name: string,
	templateFn: T,
): T {
	return ((...args: Parameters<T>) => {
		if (!DEVELOPMENT_CONFIG.ENABLE_PERFORMANCE_MONITORING) {
			return templateFn(...args)
		}

		const start = performance.now()
		const result = templateFn(...args)
		const end = performance.now()

		const renderTime = end - start
		if (DEVELOPMENT_CONFIG.ENABLE_LOGGING) {
			console.log(`Template [${name}] rendered in ${renderTime.toFixed(2)}ms`)
		}

		return result
	}) as T
}

// Template composition with validation
export function composeTemplates(
	...templates: Array<string | (() => string)>
): string {
	return templates
		.map(template => (typeof template === 'function' ? template() : template))
		.filter(Boolean)
		.join('')
}

// Enhanced validation with multiple checks
export function createValidator<T>(
	checks: Array<(value: T) => string[]>,
): (value: T) => ValidationResult {
	return (value: T) => {
		const errors = checks.flatMap(check => check(value))
		return { valid: errors.length === 0, errors }
	}
}

// Resource type detection utility (moved from performance-hints)
export function getResourceType(url: string): string {
	const extension = '.' + url.split('.').pop()?.toLowerCase()
	return (RESOURCE_TYPE_MAP as any)[extension] || DEFAULT_RESOURCE_TYPE
}

// Check if resource requires crossorigin attribute
export function requiresCrossorigin(url: string): boolean {
	return url.endsWith('.woff') || url.endsWith('.woff2')
}
