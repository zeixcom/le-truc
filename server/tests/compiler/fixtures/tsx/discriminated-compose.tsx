/**
 * LT-346 negative probe (must FAIL tsc — wired through
 * `fixtures/tsx/tsconfig.neg.json`; asserted in
 * server/tests/compiler/tsx/typecheck.test.ts). Pins LT-343: the host
 * profile's `JSX.LibraryManagedAttributes` distributes its `i18n` omission
 * over a union of arg shapes, so a discriminated args type keeps its
 * discrimination at the compose site. A plain `Omit<P, 'i18n'>` flattens
 * the union to its members' common keys — `id` goes optional — and the
 * second compose below would pass silently.
 *
 * Self-contained: the child is local (the module-codeblock shape — collapsed
 * ⇒ `id`), so the probe needs no example import and no generated
 * `tsrx-imports.d.ts`.
 */
export function DiscriminatedChild({
	id,
	collapsed,
}:
	| { id: string; collapsed: true }
	| { id?: string; collapsed?: false }) {
	return <div data-collapsed={collapsed ? 'true' : 'false'}>{id ?? ''}</div>
}

export const DiscriminatedParent = () => (
	<div>
		<DiscriminatedChild id="ok" collapsed={true} />
		<DiscriminatedChild collapsed={true} />
	</div>
)
