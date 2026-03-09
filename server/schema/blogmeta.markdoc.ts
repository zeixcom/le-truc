import { type Config, type Node, type Schema, Tag } from '@markdoc/markdoc'

const blogmeta: Schema = {
	render: 'card-blogmeta',
	selfClosing: true,
	attributes: {
		date: { type: String, required: true },
		author: { type: String, required: true },
		avatar: { type: String },
		'reading-time': { type: String },
	},
	transform(node: Node, config: Config) {
		const date = String(node.attributes['date'] ?? '')
		const author = String(node.attributes['author'] ?? '')
		const avatar = String(node.attributes['avatar'] ?? '')
		const readingTime = String(node.attributes['reading-time'] ?? '')

		const attrs: Record<string, string> = { date, author }
		if (avatar) attrs['avatar'] = avatar
		if (readingTime) attrs['reading-time'] = readingTime

		return new Tag('card-blogmeta', attrs, [
			new Tag('span', {}, [
				new Tag('img', { src: avatar, alt: author, hidden: true }, []),
				new Tag('span', {}, [author]),
			]),
			new Tag('time', { datetime: date }, [date]),
			new Tag('span', {}, [readingTime ? `${readingTime} min read` : '']),
		])
	},
}

export default blogmeta
