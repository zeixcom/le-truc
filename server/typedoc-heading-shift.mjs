// @ts-check
/**
 * TypeDoc plugin to shift heading levels in generated API docs
 *
 * ## Problem
 * TypeDoc generates markdown fragments starting with H1 for the main symbol title.
 * However, these fragments are embedded in a listnav section that has a visually
 * hidden H2 heading ("Symbols"), creating an incorrect heading hierarchy:
 *
 * - H2: "Symbols" (visually hidden, in listnav)
 *   - H1: Symbol name (in fragment) ❌ INCORRECT - should be H3
 *
 * ## Solution
 * This plugin shifts all heading levels down by 2 to create proper semantic structure:
 * - H1 → H3 (main symbol title)
 * - H2 → H4 (sections like "Parameters", "Returns")
 * - H3 → H5 (subsections)
 * - H4 → H6 (nested subsections)
 *
 * ## Implementation
 * Uses TypeDoc's page event to post-process the generated markdown before it's
 * written to disk. This ensures heading levels are adjusted consistently across
 * all API documentation pages.
 *
 * @param {any} app - TypeDoc Application instance
 */
export function load(app) {
	// Verify renderer exists
	if (!app?.renderer) {
		console.warn(
			'⚠️  TypeDoc renderer not available, skipping heading shift plugin',
		)
		return
	}

	// Listen to endPage event which fires before writing each file
	// @ts-ignore
	app.renderer.on('endPage', page => {
		// Skip pages without content
		if (!page?.contents || typeof page.contents !== 'string') {
			return
		}

		// Shift heading levels down by 2
		// Match markdown headings: # Heading, ## Heading, etc.
		// Only process H1-H4 to avoid exceeding H6 (max heading level)
		page.contents = page.contents.replace(
			/^(#{1,4})\s+(.+)$/gm,
			// @ts-ignore
			(_match, hashes, title) => {
				// Add 2 more hashes (shift down 2 levels)
				// H1 → H3, H2 → H4, H3 → H5, H4 → H6
				const newHashes = '#'.repeat(hashes.length + 2)
				return `${newHashes} ${title}`
			},
		)
	})
}
