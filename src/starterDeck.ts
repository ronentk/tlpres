import { Editor, TLShapePartial, createShapeId, toRichText } from 'tldraw'
import { SLIDE_H, SLIDE_W } from './SlideShapeUtil'

// Placeholder deck following the talk outline, laid out left to right.
// Rename / rearrange freely: order is `props.index`, not canvas position.
const STARTER: { title: string; subtitle: string; notes: string }[] = [
	{
		title: 'From Users to Sense-Makers',
		subtitle: 'Tools-for-Thought and Inner Development',
		notes: 'Welcome. Seeds of Renaissance seminar. Frame the talk: tools-for-thought as scaffolding for inner development.',
	},
	{
		title: 'The problem',
		subtitle: 'External power vs inner development (Developmental Spaces white paper)',
		notes: '',
	},
	{
		title: 'Change minds by changing the world',
		subtitle: 'Physical and social environments',
		notes: '',
	},
	{
		title: 'Epistemic environments',
		subtitle: '"Ask not what\'s inside your head but what your head\'s inside of"',
		notes: '',
	},
	{
		title: 'What is our head currently inside of?',
		subtitle: 'Social media and attention environments',
		notes: '',
	},
	{
		title: 'What could our head be inside of?',
		subtitle: 'Tools-for-thought, note-taking, Obsidian',
		notes: '',
	},
	{
		title: 'Semble',
		subtitle: 'A social tool-for-thought on AT Protocol (early findings)',
		notes: '',
	},
	{
		title: 'Field-building and funding',
		subtitle: '',
		notes: '',
	},
	{
		title: 'Closing and questions',
		subtitle: '',
		notes: '',
	},
]

const GAP = 400

export function createStarterDeck(editor: Editor) {
	const shapes: TLShapePartial[] = []
	STARTER.forEach((s, i) => {
		const x = i * (SLIDE_W + GAP)
		shapes.push({
			id: createShapeId(`slide-${i + 1}`),
			type: 'slide',
			x,
			y: 0,
			props: { w: SLIDE_W, h: SLIDE_H, index: i + 1, notes: s.notes },
		})
		shapes.push({
			id: createShapeId(`slide-${i + 1}-title`),
			type: 'text',
			x: x + 80,
			y: i === 0 ? 240 : 80,
			props: {
				richText: toRichText(s.title),
				size: i === 0 ? 'xl' : 'l',
				autoSize: false,
				w: SLIDE_W - 160,
			},
		})
		if (s.subtitle) {
			shapes.push({
				id: createShapeId(`slide-${i + 1}-sub`),
				type: 'text',
				x: x + 80,
				y: i === 0 ? 420 : 200,
				props: { richText: toRichText(s.subtitle), size: 'm', autoSize: false, w: SLIDE_W - 160 },
			})
		}
	})
	editor.createShapes(shapes)
}
