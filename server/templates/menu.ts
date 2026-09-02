import { MENU_GROUPS, PAGE_ORDER } from '../config'
import { type PageInfo } from '../file-signals'
import { createOrderedSort, html, raw } from './utils'

/* === Internal Functionals === */

const slugOf = (page: PageInfo): string => page.filename.replace('.md', '')

/**
 * Find the sidebar group a page belongs to, if any.
 * Groups are disjoint by config convention; the first match wins.
 */
export const groupOf = (slug: string) =>
	MENU_GROUPS.find(group => group.pages.includes(slug as never))

/* === Exported Functions === */

/**
 * Menu item template — icon + title, no description caption.
 * When `currentSlug` matches the page's own slug, the item is marked as the
 * active page with `aria-current="page"` and `class="active"`.
 */
export function menuItem(
	page: PageInfo,
	currentSlug?: string,
	basePath = './',
): string {
	const isCurrent = currentSlug !== undefined && slugOf(page) === currentSlug
	return html`<li>
		<a href="${basePath}${page.url}"${raw(isCurrent ? ' aria-current="page" class="active"' : '')}>${page.title}</a>
	</li>`
}

// Group heading rendered between menu items
export function menuGroup(title: string): string {
	return html`<li class="group" role="presentation">${title}</li>`
}

/**
 * Main sidebar menu template — renders `MENU_GROUPS` in order, each as a
 * heading followed by its member pages (sorted by `PAGE_ORDER`).
 *
 * `currentSlug` marks the active page in the sidebar: pass the page's own
 * slug for root pages, or its section (e.g. `"blog"`, `"api"`) for pages
 * that live under a root page (blog posts, API symbol pages) so the parent
 * menu item is marked active instead.
 */
export function menu(
	pages: PageInfo[],
	currentSlug?: string,
	basePath = './',
): string {
	// Get only root pages (no section) and sort them using common utility
	const rootPages = pages
		.filter(p => !p.section)
		.sort(createOrderedSort<PageInfo>(PAGE_ORDER))

	// Insert each group heading once, before its first member in sort order
	const renderedHeadings = new Set<string>()
	const items = rootPages.map(page => {
		const group = groupOf(slugOf(page))
		if (!group || renderedHeadings.has(group.title))
			return menuItem(page, currentSlug, basePath)
		renderedHeadings.add(group.title)
		return menuGroup(group.title) + menuItem(page, currentSlug, basePath)
	})

	return html`<section-menu id="sidebar">
		<module-scrollarea>
			<nav>
				<h2 class="visually-hidden">Main Menu</h2>
				<ol>
					${items}
				</ol>
			</nav>
		</module-scrollarea>
	</section-menu>`
}
