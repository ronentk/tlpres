import { useEffect, useRef } from 'react'
import {
	Geometry2d,
	HTMLContainer,
	RecordProps,
	Rectangle2d,
	ShapeUtil,
	T,
	TLResizeInfo,
	TLShape,
	resizeBox,
	stopEventPropagation,
	useIsEditing,
} from 'tldraw'

const TYPE = 'collapsible' as const
export const COLLAPSED_H = 52

declare module 'tldraw' {
	export interface TLGlobalShapePropsMap {
		[TYPE]: {
			w: number
			/** Height when open. Collapsed height is fixed (COLLAPSED_H). */
			h: number
			title: string
			body: string
			open: boolean
		}
	}
}

export type CollapsibleShape = TLShape<typeof TYPE>

// A text box that shows only its title until you click it (works in edit mode).
//  - click: toggle open/closed        - double-click: edit title and text
//  - drag: move                        - resize handles: width (and height when open)
export class CollapsibleShapeUtil extends ShapeUtil<CollapsibleShape> {
	static override type = TYPE
	static override props: RecordProps<CollapsibleShape> = {
		w: T.number,
		h: T.number,
		title: T.string,
		body: T.string,
		open: T.boolean,
	}

	override hideRotateHandle() {
		return true
	}
	override onRotate(initial: CollapsibleShape) {
		return initial
	}

	getDefaultProps(): CollapsibleShape['props'] {
		return { w: 380, h: 220, title: 'Click to reveal', body: 'Double-click to edit this text.', open: false }
	}

	getGeometry(shape: CollapsibleShape): Geometry2d {
		const h = shape.props.open ? shape.props.h : COLLAPSED_H
		return new Rectangle2d({ width: shape.props.w, height: h, isFilled: true })
	}

	override canEdit() {
		return true
	}

	override onClick(shape: CollapsibleShape) {
		return { id: shape.id, type: TYPE, props: { open: !shape.props.open } }
	}

	override onDoubleClick(shape: CollapsibleShape) {
		this.editor.setEditingShape(shape.id)
		// Editing the text only makes sense while it is visible.
		return shape.props.open ? undefined : { id: shape.id, type: TYPE, props: { open: true } }
	}

	override onResize(shape: CollapsibleShape, info: TLResizeInfo<CollapsibleShape>) {
		const resized = resizeBox(shape, info)
		// Collapsed boxes only resize horizontally; the hidden (open) height is left alone.
		if (!shape.props.open) {
			return { ...resized, y: shape.y, props: { ...resized.props, h: shape.props.h } }
		}
		return resized
	}

	component(shape: CollapsibleShape) {
		const { w, h, title, body, open } = shape.props
		// Hooks are fine here: tldraw renders `component` as a React component.
		// eslint-disable-next-line react-hooks/rules-of-hooks
		const editing = useIsEditing(shape.id)
		// eslint-disable-next-line react-hooks/rules-of-hooks
		const titleRef = useRef<HTMLInputElement>(null)
		// tldraw can steal focus right after a double-click, so focus the title once editing starts.
		// eslint-disable-next-line react-hooks/rules-of-hooks
		useEffect(() => {
			if (!editing) return
			const id = setTimeout(() => {
				titleRef.current?.focus()
				titleRef.current?.select()
			}, 50)
			return () => clearTimeout(id)
		}, [editing])
		const update = (props: Partial<CollapsibleShape['props']>) =>
			this.editor.updateShape({ id: shape.id, type: TYPE, props })
		// Inputs must not start tldraw drags/selection or trigger its keyboard shortcuts.
		const guard = {
			onPointerDown: stopEventPropagation,
			onPointerUp: stopEventPropagation,
			onKeyDown: (e: React.KeyboardEvent) => {
				e.stopPropagation()
				if (e.key === 'Escape') this.editor.setEditingShape(null)
			},
		}

		return (
			<HTMLContainer
				className="collapsible-shape"
				style={{ width: w, height: open ? h : COLLAPSED_H, pointerEvents: 'all' }}
			>
				<div className="collapsible-header">
					<span className="collapsible-chevron">{open ? '▾' : '▸'}</span>
					{editing ? (
						<input
							className="collapsible-title-input"
							ref={titleRef}
							value={title}
							onChange={(e) => update({ title: e.target.value })}
							{...guard}
						/>
					) : (
						<span className="collapsible-title">{title || 'Untitled'}</span>
					)}
				</div>
				{open &&
					(editing ? (
						<textarea
							className="collapsible-body-input"
							value={body}
							onChange={(e) => update({ body: e.target.value })}
							{...guard}
						/>
					) : (
						<div className="collapsible-body">{body}</div>
					))}
			</HTMLContainer>
		)
	}

	getIndicatorPath(shape: CollapsibleShape) {
		const path = new Path2D()
		path.roundRect(0, 0, shape.props.w, shape.props.open ? shape.props.h : COLLAPSED_H, 10)
		return path
	}

	// Used by image / PDF export (the HTML above is not part of SVG export). Plain, no text wrapping.
	override toSvg(shape: CollapsibleShape) {
		const { w, h, title, body, open } = shape.props
		const height = open ? h : COLLAPSED_H
		return (
			<g fontFamily="sans-serif" fill="#1d1d1d">
				<rect width={w} height={height} rx={10} fill="#fff" stroke="#1d1d1d" strokeWidth={2} />
				<text x={16} y={33} fontSize={22} fontWeight={700}>{`${open ? '▾' : '▸'} ${title}`}</text>
				{open &&
					body.split('\n').map((line, i) => (
						<text key={i} x={16} y={74 + i * 28} fontSize={20}>
							{line}
						</text>
					))}
			</g>
		)
	}
}
