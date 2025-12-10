/**
 * Table of Contents Template
 *
 * Tagged template literal for generating table of contents HTML.
 * Provides syntax highlighting and automatic escaping.
 */

import { generateSlug, html } from './utils'

// Individual TOC item template
export function tocItem(slug: string, heading: string): string {
	return html` <li>
		<a href="#${slug}">${heading}</a>
	</li>`
}

// Main table of contents template
export function toc(markdownContent: string): string {
	// Extract H2 headings directly from markdown content
	const h2Matches = markdownContent.match(/^## (.+)$/gm)

	if (!h2Matches || h2Matches.length === 0) {
		return '' // Return empty string if no H2 headings found
	}

	// Process each H2 heading
	const headings = h2Matches.map(match => {
		const heading = match.replace('## ', '').trim()
		const slug = generateSlug(heading)
		return { slug, heading }
	})

	return html`<module-toc>
		<nav>
			<h2>On This Page</h2>
			<ol>
				${headings.map(({ slug, heading }) => tocItem(slug, heading))}
			</ol>
		</nav>
	</module-toc>`
}
