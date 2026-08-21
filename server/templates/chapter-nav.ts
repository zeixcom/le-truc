import { html } from './utils'

/* === Types === */

/** Link to a chapter sibling page. */
export interface ChapterLink {
	url: string
	title: string
}

/* === Internal Functionals === */

const linkItem = (direction: 'prev' | 'next', link: ChapterLink): string =>
	html`<li>
		<a class="${direction}" rel="${direction}" href="${link.url}"
			>${link.title}</a
		>
	</li>`

/* === Exported Functions === */

/**
 * Prev/next stepper for guide chapters, rendered below the content of
 * every chapter member page. Arrows are CSS-generated (::before/::after)
 * so the link text stays plain. Returns '' when both links are missing.
 * Like the menu template, nested items are built as an array of
 * pre-rendered strings, which the html tag joins without re-escaping.
 */
export function chapterNav(
	chapterTitle: string,
	part: number,
	total: number,
	prev?: ChapterLink,
	next?: ChapterLink,
): string {
	if (!prev && !next) return ''
	const items = [
		...(prev ? [linkItem('prev', prev)] : []),
		...(next ? [linkItem('next', next)] : []),
	]
	return html`<nav class="content chapter-nav" aria-label="Chapter navigation">
		<p class="chapter">${chapterTitle} · Part ${part} of ${total}</p>
		<ul>
			${items}
		</ul>
	</nav>`
}
