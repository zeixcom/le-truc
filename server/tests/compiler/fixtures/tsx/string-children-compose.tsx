/**
 * LT-495 positive probe (must compile clean — the default
 * `fixtures/tsx/tsconfig.json`). Pins the host profile's compose-site
 * children translation: a child declaring `children?: string` (the
 * server-side truth — the compiler lowers compose-site children to a
 * markup string) accepts JSX element children, text, and a mix, singly or
 * as several. The function-child failure is the negative twin,
 * `string-children-bad.tsx`.
 */
export function StringChildrenChild({
	kind,
	children = '',
}: {
	kind?: string
	children?: string
}) {
	return <div class={kind ?? ''}>{children}</div>
}

/** A required string `children` keeps its requiredness at the compose site. */
export function RequiredStringChildrenChild({ children }: { children: string }) {
	return <div>{children}</div>
}

export const StringChildrenParent = () => (
	<div>
		<StringChildrenChild>
			<p>one element</p>
		</StringChildrenChild>
		<StringChildrenChild kind="note">
			<p>first</p>
			<p>second</p>
		</StringChildrenChild>
		<StringChildrenChild>plain text</StringChildrenChild>
		<StringChildrenChild>
			text and <strong>an element</strong>
		</StringChildrenChild>
		<StringChildrenChild />
		<RequiredStringChildrenChild>
			<p>required</p>
		</RequiredStringChildrenChild>
	</div>
)
