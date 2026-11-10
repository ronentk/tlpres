import { useCallback } from 'react'
import {
	Geometry2d,
	RecordProps,
	Rectangle2d,
	SVGContainer,
	ShapeUtil,
	T,
	TLResizeInfo,
	TLShape,
	getPerfectDashProps,
	resizeBox,
	useValue,
} from 'tldraw'
import { $overview, $presenting, moveToSlide, useSlides } from './presentation'

export const SLIDE_W = 1280
export const SLIDE_H = 720

const SLIDE_TYPE = 'slide'

// Teach TypeScript about our custom shape's props (tldraw's module-augmentation pattern).
declare module 'tldraw' {
	export interface TLGlobalShapePropsMap {
		[SLIDE_TYPE]: {
			w: number
			h: number
			/** Explicit presentation order (1-based). 0 = unassigned; a create-handler fills it in. */
			index: number
			/** Speaker notes, shown in the notes panel / presenter window. */
			notes: string
		}
	}
}

export type SlideShape = TLShape<typeof SLIDE_TYPE>

export class SlideShapeUtil extends ShapeUtil<SlideShape> {
	static override type = SLIDE_TYPE
	static override props: RecordProps<SlideShape> = {
		w: T.number,
		h: T.number,
		index: T.number,
		notes: T.string,
	}

	override canBind() {
		return false
	}
	override hideRotateHandle() {
		return true
	}
	// Keep slides 16:9 when resizing.
	override isAspectRatioLocked() {
		return true
	}

	getDefaultProps(): SlideShape['props'] {
		return { w: SLIDE_W, h: SLIDE_H, index: 0, notes: '' }
	}

	getGeometry(shape: SlideShape): Geometry2d {
		// Unfilled, so clicking inside a slide selects the content on it, not the slide itself.
		return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: false })
	}

	// Slides can't be rotated.
	override onRotate(initial: SlideShape) {
		return initial
	}

	override onResize(shape: SlideShape, info: TLResizeInfo<SlideShape>) {
		return resizeBox(shape, info)
	}

	override onDoubleClick(shape: SlideShape) {
		moveToSlide(this.editor, shape)
	}

	override onDoubleClickEdge(shape: SlideShape) {
		moveToSlide(this.editor, shape)
	}

	component(shape: SlideShape) {
		const bounds = this.editor.getShapeGeometry(shape).bounds

		// Hooks are fine here: tldraw renders `component` as a React component.
		/* eslint-disable react-hooks/rules-of-hooks */
		const zoomLevel = useValue('zoom level', () => this.editor.getZoomLevel(), [this.editor])
		const presenting = useValue($presenting)
		const overview = useValue($overview)
		const slides = useSlides()
		const index = slides.findIndex((s) => s.id === shape.id)
		const handleLabelPointerDown = useCallback(() => this.editor.select(shape.id), [shape.id])
		/* eslint-enable react-hooks/rules-of-hooks */

		if (!bounds) return null
		// While presenting, the slide chrome disappears (the dashed outline stays only in the overview).
		if (presenting && !overview) return null

		return (
			<>
				{!presenting && (
					<div onPointerDown={handleLabelPointerDown} className="slide-shape-label">
						{`Slide ${index + 1}`}
					</div>
				)}
				<SVGContainer>
					<g
						style={{
							stroke: 'var(--tl-color-text)',
							strokeWidth: 'calc(1px * var(--tl-scale))',
							opacity: 0.25,
						}}
						pointerEvents="none"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						{bounds.sides.map((side, i) => {
							const { strokeDasharray, strokeDashoffset } = getPerfectDashProps(
								side[0].dist(side[1]),
								1 / zoomLevel,
								{ style: 'dashed', lengthRatio: 6, forceSolid: zoomLevel < 0.2 }
							)
							return (
								<line
									key={i}
									x1={side[0].x}
									y1={side[0].y}
									x2={side[1].x}
									y2={side[1].y}
									strokeDasharray={strokeDasharray}
									strokeDashoffset={strokeDashoffset}
								/>
							)
						})}
					</g>
				</SVGContainer>
			</>
		)
	}

	getIndicatorPath(shape: SlideShape) {
		const path = new Path2D()
		path.rect(0, 0, shape.props.w, shape.props.h)
		return path
	}
}
