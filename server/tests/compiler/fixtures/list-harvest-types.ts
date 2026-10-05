/**
 * An item type declared in another module (LT-429): the compiler reads no
 * other module, so a list of these lists its fields through `harvest()`.
 */
export type DueTask = {
	id: string
	label: string
	due: Date
}
