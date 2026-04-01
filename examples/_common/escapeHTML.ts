/**
 * Escapes HTML entities to prevent XSS attacks
 */
export function escapeHTML(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

export const html = (strings: TemplateStringsArray, ...values: any[]): string =>
	String.raw({ raw: strings }, ...values)
