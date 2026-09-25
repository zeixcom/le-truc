/**
 * The `.tsrx` twin of `sync-el.tsx` (LT-303): the same control-flow shapes
 * spelled as directives. The parity suite compares the two server modules
 * byte-for-byte.
 */
export type SyncItem = { id: string; label: string }

/** No exposed properties — the component renders server data only. */
export type SyncElProps = Record<string, never>

export function SyncEl({ mode, items }: { mode: string; items: SyncItem[] })
	@{
		expose({})

		<>
			<sync-el>
				@switch (mode) {
					@case 'list': {
						<ul data-container>
							@for (const item of items; index i) {
								const upper = item.label.toUpperCase()
								<li data-value={item.id}>{i}: {upper}</li>
							}
						</ul>
					}
					@default: {
						<p class="empty">none</p>
					}
				}
				@try {
					<p class="first">{items[0]!.label}</p>
				} @catch (e) {
					<p class="none">empty list</p>
				}
				@if (mode === 'list') {
					<span class="badge">listing</span>
				}
				@if (items.length > 0) {
					<span class="count">{items.length}</span>
				} @else {
					<span class="zero">0</span>
				}
			</sync-el>
			<style>sync-el { display: block }</style>
		</>
	}
