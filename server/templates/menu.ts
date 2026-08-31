import { CHAPTERS, PAGE_ORDER } from '../config'
import { type PageInfo } from '../file-signals'
import { createOrderedSort, html } from './utils'

/* === Internal Functionals === */

const slugOf = (page: PageInfo): string => page.filename.replace('.md', '')

/**
 * Find the chapter a page belongs to, if any.
 * Chapters are disjoint by config convention; the first match wins.
 */
export const chapterOf = (slug: string) =>
	CHAPTERS.find(chapter => chapter.pages.includes(slug as never))

/* === Exported Functions === */

// Menu item template
export function menuItem(page: PageInfo): string {
	return html`<li>
		<a href="${page.url}">
			<span class="icon">${page.emoji}</span>
			<strong>${page.title}</strong>
			<small>${page.description}</small>
		</a>
	</li>`
}

// Chapter group heading rendered between menu items
export function menuGroup(title: string): string {
	return html`<li class="group" role="presentation">${title}</li>`
}

// Main menu template
export function menu(pages: PageInfo[]): string {
	// Get only root pages (no section) and sort them using common utility
	const rootPages = pages
		.filter(p => !p.section)
		.sort(createOrderedSort<PageInfo>(PAGE_ORDER))

	// Insert each chapter heading once, before its first member in sort order
	const renderedHeadings = new Set<string>()
	const items = rootPages.map(page => {
		const chapter = chapterOf(slugOf(page))
		if (!chapter || renderedHeadings.has(chapter.title)) return menuItem(page)
		renderedHeadings.add(chapter.title)
		return menuGroup(chapter.title) + menuItem(page)
	})

	return html`<section-menu>
		<nav>
			<h2 class="visually-hidden">Main Menu</h2>
			<ol>
				${items}
			</ol>
		</nav>
	</section-menu>`
}
