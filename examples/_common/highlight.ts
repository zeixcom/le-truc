/**
 * Escapes HTML entities to prevent XSS attacks
 */
function escapeHTML(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

/**
 * Safely creates HTML with highlighted matches
 * @param text - The text to escape and optionally highlight
 * @param highlightPattern - Optional string or RegExp to highlight with <mark> tags
 * @returns Safe HTML string with escaped entities and highlighted matches
 */
export function highlightMatch(
	text: string,
	highlightPattern?: string | RegExp,
): string {
	if (!highlightPattern) return escapeHTML(text)

	// Convert string pattern to RegExp with global and case-insensitive flags
	const pattern =
		typeof highlightPattern === 'string'
			? new RegExp(
					highlightPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
					'giu',
				)
			: highlightPattern

	// Escape the entire text first
	const escapedText = escapeHTML(text)

	// Find all matches in the original text to get correct positions
	const matches: Array<{ start: number; end: number; text: string }> = []
	let match: RegExpExecArray | null

	// Reset lastIndex for global RegExp
	pattern.lastIndex = 0

	while ((match = pattern.exec(text)) !== null) {
		matches.push({
			start: match.index,
			end: match.index + match[0].length,
			text: match[0],
		})
		// Prevent infinite loop on zero-length matches
		if (match.index === pattern.lastIndex) pattern.lastIndex++
	}

	if (matches.length === 0) return escapedText

	// Build result by escaping and wrapping matches
	let result = ''
	let lastIndex = 0

	for (const { start, end, text: matchText } of matches) {
		// Add text before match (escaped)
		result += escapeHTML(text.slice(lastIndex, start))
		// Add highlighted match (escaped)
		result += `<mark>${escapeHTML(matchText)}</mark>`
		lastIndex = end
	}

	// Add remaining text (escaped)
	result += escapeHTML(text.slice(lastIndex))

	return result
}
