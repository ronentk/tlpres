import type { Editor, TLShapeId } from 'tldraw'

// Presentation mode makes the canvas read-only, but toggling a collapsible box / image note open
// or closed is just a view change, so it is allowed there. Editing text stays blocked.
export function toggleOpen(editor: Editor, id: TLShapeId) {
	const shape = editor.getShape(id) as any
	if (!shape) return
	const readonly = editor.getInstanceState().isReadonly
	if (readonly) editor.updateInstanceState({ isReadonly: false })
	try {
		editor.updateShape({ id, type: shape.type, props: { open: !shape.props.open } })
	} finally {
		if (readonly) editor.updateInstanceState({ isReadonly: true })
	}
}
