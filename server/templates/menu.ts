import { PAGE_ORDER } from '../config'
import { type PageInfo } from '../file-signals'
import { createOrderedSort, html, type SortableItem } from './utils'

/* === Exported Functions === */

// Menu item template
export function menuItem(page: PageInfo): string {
	return html` <li>
		<a href="${page.url}">
			<span class="icon">${page.emoji}</span>
			<strong>${page.title}</strong>
			<small>${page.description}</small>
		</a>
	</li>`
}

// Main menu template
export function menu(pages: PageInfo[]): string {
	// Get only root pages (no section) and sort them using common utility
	const rootPages = pages
		.filter(p => !p.section)
		.sort(createOrderedSort<PageInfo & SortableItem>(PAGE_ORDER))

	return html` <section-menu>
		<nav>
			<h2 class="visually-hidden">Main Menu</h2>
			<ol>
				${rootPages.map(page => menuItem(page))}
			</ol>
		</nav>
	</section-menu>`
}
