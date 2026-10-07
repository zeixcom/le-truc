/**
 * LT-495 negative probe (must FAIL tsc — wired through
 * `fixtures/tsx/tsconfig.neg.json`; asserted in
 * server/tests/compiler/tsx/typecheck.test.ts). The compose-site children
 * translation of a `children?: string` arg admits elements and text only:
 * a function child is not something the compose lowering can render, so
 * it stays a tsc error — and so does omitting a required `children`.
 */
export function BadStringChildrenChild({ children = '' }: { children?: string }) {
	return <div>{children}</div>
}

export function BadRequiredChildrenChild({ children }: { children: string }) {
	return <div>{children}</div>
}

export const BadStringChildrenParent = () => (
	<div>
		<BadStringChildrenChild>{() => <p>render prop</p>}</BadStringChildrenChild>
		<BadRequiredChildrenChild />
	</div>
)
