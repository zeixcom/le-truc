export const highlightMatch = (text: string, query: string): string => {
	if (!query) return text
	const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
	return text.replace(regex, '<mark>$&</mark>')
}
