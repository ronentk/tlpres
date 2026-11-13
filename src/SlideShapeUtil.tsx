import { useCallback } from 'react'
import {
	Geometry2d,
	RecordProps,
	Rectangle2d,
	SVGContainer,
	ShapeUtil,
	T,
	TLResizeInfo,
	TLBaseShape,
	getPerfectDashProps,
	resizeBox,
	useValue,
} from 'tldraw'
import { $overview, $presenting, moveToSlide, useSequence } from './presentation'

export const SLIDE_W = 1280
export const SLIDE_H = 720

const SLIDE_TYPE = 'slide'

export type SlideShape = TLBaseShape<
	typeof SLIDE_TYPE,
	{
		w: number
		h: number
		/** Explicit presentation order (1-based). 0 = unassigned; a create-handler fills it in. */
		index: number
		/** Speaker notes, shown in the notes panel / presenter window. */
		notes: string
	}
>

export class SlideShapeUtil extends ShapeUtil<SlideShape> {
	static override type = SLIDE_TYPE
	static override props: RecordProps<SlideShape> = {
		w: T.number,
		h: T.number,
		index: T.number,
		notes: T.string,
	}

	// Arrows can attach to slides, so you can draw connections between slides on the map and they
	// follow when a slide is moved. (The geometry is unfilled, so only the border/label snaps.)
	override canBind() {
		return true
	}
	override hideRotateHandle() {
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

	// Keep slides 16:9, both when drawing a new slide and when resizing one. (Don't use
	// isAspectRatioLocked: while drawing, the shape starts 1x1, so it would lock to a square.)
	override onResize(shape: SlideShape, info: TLResizeInfo<SlideShape>) {
		const resized = resizeBox(shape, info)
		const h = (resized.props.w * SLIDE_H) / SLIDE_W
		const bottom = resized.y + resized.props.h
		// If the top edge moved, keep the bottom edge anchored.
		const y = resized.y !== shape.y ? bottom - h : resized.y
		return { ...resized, y, props: { ...resized.props, h } }
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
		const sequence = useSequence()
		// Every position this slide has in the talk, e.g. "Slide 3, 7" when it is revisited.
		const positions = sequence.flatMap((s, i) => (s.id === shape.id ? [i + 1] : []))
		const handleLabelPointerDown = useCallback(() => this.editor.select(shape.id), [shape.id])
		/* eslint-enable react-hooks/rules-of-hooks */

		if (!bounds) return null
		// While presenting, the slide chrome disappears (the dashed outline stays only in the overview).
		if (presenting && !overview) return null

		return (
			<>
				{!presenting && (
					<div onPointerDown={handleLabelPointerDown} className="slide-shape-label">
						{`Slide ${positions.join(', ') || '–'}`}
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

	indicator(shape: SlideShape) {
		return <rect width={shape.props.w} height={shape.props.h} />
	}
}
