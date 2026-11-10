import { BaseBoxShapeTool } from 'tldraw'

// Drag out a new slide on the canvas (shortcut `S`, registered in App.tsx).
export class SlideShapeTool extends BaseBoxShapeTool {
	static override id = 'slide'
	static override initial = 'idle'
	override shapeType = 'slide' as const
}
