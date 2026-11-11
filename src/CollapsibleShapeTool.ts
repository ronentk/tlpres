import { BaseBoxShapeTool } from 'tldraw'

// Click (or drag) on the canvas to place a collapsible text box. Shortcut `C`, set in App.tsx.
export class CollapsibleShapeTool extends BaseBoxShapeTool {
	static override id = 'collapsible'
	static override initial = 'idle'
	override shapeType = 'collapsible' as const
}
