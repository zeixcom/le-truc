export const html = (strings: TemplateStringsArray, ...values: any[]): string =>
	String.raw({ raw: strings }, ...values)
