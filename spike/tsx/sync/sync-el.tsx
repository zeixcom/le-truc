/**
 * TSX spike §4.4 synthetic fixture (LT-183): the statement-context control
 * flow shapes through the UNMODIFIED analysis —
 *
 * - `@switch` → an IIFE whose body is the switch, each arm `return <jsx/>`;
 * - the plain `@try`/`@catch` error boundary → a try/catch IIFE;
 * - `@for` over server data → `.map((item, index) => { hoisted; return … })`
 *   (form-listbox's real loop already exercises the template-position case;
 *   this one adds the INDEX binding);
 * - single-branch `@if` (`&&`) and both-arms ternary, beside each other.
 */
import type { FactoryContext } from '@zeix/le-truc'

export type SyncItem = { id: string; label: string }

/** No exposed properties — the component renders server data only. */
export type SyncElProps = Record<string, never>

export function SyncEl(
	{ mode, items }: { mode: string; items: SyncItem[] },
	{ expose }: FactoryContext<SyncElProps>,
) {
	expose({})

	return (
		<>
			<sync-el>
				{(() => {
					switch (mode) {
						case 'list':
							return <ul data-container>
								{items.map((item, i) => {
									const upper = item.label.toUpperCase()
									return <li data-value={item.id}>{i}: {upper}</li>
								})}
							</ul>
						default:
							return <p class="empty">none</p>
					}
				})()}
				{(() => {
					try {
						return <p class="first">{items[0]!.label}</p>
					} catch (e) {
						return <p class="none">empty list</p>
					}
				})()}
				{mode === 'list' && <span class="badge">listing</span>}
				{items.length > 0 ? <span class="count">{items.length}</span> : <span class="zero">0</span>}
			</sync-el>
			<style>{css`sync-el { display: block }`}</style>
		</>
	)
}
