/**
 * Wave-4 migration (LT-095) of the hand-written basic-blogmeta.ts, reshaped
 * from a light-DOM enhancer into a template owner with typed byline props
 * (LT-033 decision, 2026-08-29). The `.ts` twin stays beside this source as
 * the variant set's other member (ADR 0039), and every member declares its
 * own `HTMLElementTagNameMap` entry (s4).
 *
 * The template re-emits all the schema.org microdata the old light DOM
 * carried: the `author` Person, `datePublished`, `dateModified`, and a
 * `timeRequired` meta derived from `reading-time`. There is no arbitrary
 * pass-through (the card-mediaqueries precedent): consumers write only the
 * attributes, and the page renderer expands each occurrence with this
 * component's server render (LT-194: Folded, declares `i18n`, exports
 * `argsFromAttrs`).
 *
 * Deviations the reshape decided or implies:
 * - dates format at render time in the page's locale, via `Date.UTC` and a
 *   `timeZone: 'UTC'` formatter (ADR 0030 s2), so nothing reads the build
 *   machine's clock or zone and the component folds. The twin's
 *   `new Date(y, m - 1, d)` with a zone-less formatter did not survive;
 * - an invalid or missing `modified` omits the modified span, and an invalid
 *   or missing `published` renders `t.unknownDate`, as the twin did at
 *   connect. The fallback avatar renders when `avatar` is absent;
 * - `author` is optional, because the blog archive's entries carry a date
 *   only. With no author, the author span is omitted;
 * - the byline's prose routes through `t`.
 */

export const i18n = {
	avatarOf: 'Avatar of',
	updatedOn: 'updated on',
	minRead: 'min read',
	unknownDate: 'unknown date',
} as const

declare global {
	interface HTMLElementTagNameMap {
		'basic-blogmeta': HTMLElement
	}
}

/**
 * Renders a blog post's byline: author, publication and modification dates, and reading time, with schema.org microdata.
 * Use it for blog post or article metadata — dates are formatted in the page's locale
 * when the page is built, so the byline is complete without JavaScript.
 * The date values must be ISO dates (`YYYY-MM-DD`); an invalid `modified` date is omitted.
 * Without an `avatar`, a stylized placeholder avatar is rendered.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#basic-blogmeta} Interactive preview and usage examples
 **/
export function BasicBlogmeta({
	author,
	avatar,
	published,
	modified,
	readingTime,
	i18n: { t, lang },
}: {
	/** The author's display name. */
	author?: string
	/** URL of the author's avatar image. */
	avatar?: string
	/** Publication date, `YYYY-MM-DD`. */
	published?: string
	/** Last modification date, `YYYY-MM-DD`. */
	modified?: string
	/** Reading time in minutes (the `reading-time` attribute). */
	readingTime?: number
	i18n: I18n<typeof i18n>
}) {
	const formatDate = (isoDate: string | undefined): string | null => {
		const [year, month, day] = (isoDate ?? '').split('-').map(Number)
		if (!year || !month || !day || month > 12) return null
		// Days in the month by UTC arithmetic alone: `Date.UTC` rolls an
		// out-of-range day over into the next month instead of failing.
		const daysInMonth =
			(Date.UTC(year, month, 1) - Date.UTC(year, month - 1, 1)) / 86_400_000
		if (day > daysInMonth) return null
		return new Intl.DateTimeFormat(lang, {
			dateStyle: 'long',
			timeZone: 'UTC',
		}).format(Date.UTC(year, month - 1, day))
	}
	const publishedText = formatDate(published) ?? t.unknownDate
	const modifiedText = formatDate(modified)

	return (
		<>
			<basic-blogmeta>
				{author && (
					<span
						class="author"
						itemprop="author"
						itemscope
						itemtype="https://schema.org/Person"
					>
						{avatar ? (
							<img
								class="avatar"
								src={avatar}
								alt={`${t.avatarOf} ${author}`}
							/>
						) : (
							// Bootstrap Icons "person-circle" (MIT licensed)
							<svg
								class="avatar"
								viewBox="0 0 16 16"
								fill="currentColor"
								aria-hidden="true"
								focusable="false"
							>
								<path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
								<path
									fill-rule="evenodd"
									d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z"
								/>
							</svg>
						)}
						<span itemprop="name">{author}</span>
					</span>
				)}
				<span>
					<time
						class="published"
						itemprop="datePublished"
						datetime={published ?? ''}
					>
						{publishedText}
					</time>
					{modifiedText && (
						<span class="modified">
							· {t.updatedOn}{' '}
							<time itemprop="dateModified" datetime={modified ?? ''}>
								{modifiedText}
							</time>
						</span>
					)}
				</span>
				{readingTime ? (
					<span>
						<meta itemprop="timeRequired" content={`PT${readingTime}M`} />
						{readingTime} {t.minRead}
					</span>
				) : null}
			</basic-blogmeta>
			<style>{css`
basic-blogmeta {
	display: flex;
	align-items: center;
	gap: var(--space-m);
	font-size: var(--font-size-s);
	color: var(--color-text-soft);
	flex-wrap: wrap;
	margin-bottom: var(--space-l);

	& span {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	& img,
	& svg.avatar {
		width: var(--input-height);
		height: var(--input-height);
		border-radius: 50%;
		object-fit: cover;
		flex-shrink: 0;
	}

	& svg.avatar {
		color: var(--color-border-soft);
		background-color: var(--color-background-alt);
	}

	& time {
		font-variant-numeric: tabular-nums;
	}
}
`}</style>
		</>
	)
}
