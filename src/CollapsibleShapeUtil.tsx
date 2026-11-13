import { useEffect, useRef } from 'react'
import {
	Geometry2d,
	HTMLContainer,
	RecordProps,
	Rectangle2d,
	RichTextLabel,
	ShapeUtil,
	T,
	TLResizeInfo,
	TLRichText,
	TLBaseShape,
	atom,
	createShapePropsMigrationIds,
	createShapePropsMigrationSequence,
	renderHtmlFromRichText,
	renderPlaintextFromRichText,
	resizeBox,
	richTextValidator,
	stopEventPropagation,
	toRichText,
	useIsEditing,
	useValue,
} from 'tldraw'

const TYPE = 'collapsible' as const
export const COLLAPSED_H = 52

// Which part is being edited: the title (a plain input) or the body (tldraw's rich-text editor).
// Set on double-click from where you clicked. tldraw has only one "editing shape" per shape, so
// we track the part ourselves.
const $editPart = atom<'title' | 'body'>('collapsible edit part', 'title')

// Decks saved before the body became rich text stored it as a plain `body` string.
const migrationIds = createShapePropsMigrationIds(TYPE, { RichTextBody: 1 })

export type CollapsibleShape = TLBaseShape<
	typeof TYPE,
	{
		w: number
		/** Height when open. Collapsed height is fixed (COLLAPSED_H). */
		h: number
		title: string
		/** Formatted body text (tldraw rich text: bold, italic, underline, lists, links...). */
		richText: TLRichText
		open: boolean
	}
>

// A text box that shows only its title until you click it (works in edit mode).
//  - click: toggle open/closed        - double-click: edit title and text
//  - drag: move                        - resize handles: width (and height when open)
export class CollapsibleShapeUtil extends ShapeUtil<CollapsibleShape> {
	static override type = TYPE
	static override props: RecordProps<CollapsibleShape> = {
		w: T.number,
		h: T.number,
		title: T.string,
		richText: richTextValidator,
		open: T.boolean,
	}

	static override migrations = createShapePropsMigrationSequence({
		sequence: [
			{
				id: migrationIds.RichTextBody,
				up(props: any) {
					props.richText = toRichText(typeof props.body === 'string' ? props.body : '')
					delete props.body
				},
				down(props: any) {
					props.body = ''
					delete props.richText
				},
			},
		],
	})

	override hideRotateHandle() {
		return true
	}
	override onRotate(initial: CollapsibleShape) {
		return initial
	}

	getDefaultProps(): CollapsibleShape['props'] {
		return { w: 380, h: 220, title: 'Click to reveal', richText: toRichText('Double-click to edit this text.'), open: false }
	}

	getGeometry(shape: CollapsibleShape): Geometry2d {
		const h = shape.props.open ? shape.props.h : COLLAPSED_H
		return new Rectangle2d({ width: shape.props.w, height: h, isFilled: true })
	}

	override canEdit() {
		return true
	}

	// Only a click on the header bar toggles. Clicking the body must not, otherwise the first click of
	// a double-click would collapse the box and the second would land on empty canvas (which makes
	// tldraw create a stray text shape).
	override onClick(shape: CollapsibleShape) {
		const local = this.editor.getPointInShapeSpace(shape, this.editor.inputs.currentPagePoint)
		if (local.y > COLLAPSED_H) return
		return { id: shape.id, type: TYPE, props: { open: !shape.props.open } }
	}

	// Don't start editing here: tldraw does that itself right after this returns (canEdit is true),
	// and it refuses (and creates a stray text shape instead) if the shape is already being edited.
	override onDoubleClick(shape: CollapsibleShape) {
		// Where did the double-click land? Header = title, below it (when open) = body.
		const local = this.editor.getPointInShapeSpace(shape, this.editor.inputs.currentPagePoint)
		$editPart.set(shape.props.open && local.y > COLLAPSED_H ? 'body' : 'title')
		// Editing the text only makes sense while it is visible, so make sure the box is open.
		if (!shape.props.open) {
			this.editor.updateShape({ id: shape.id, type: TYPE, props: { open: true } })
		}
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
		const { w, h, title, richText, open } = shape.props
		// Hooks are fine here: tldraw renders `component` as a React component.
		/* eslint-disable react-hooks/rules-of-hooks */
		const editing = useIsEditing(shape.id)
		const part = useValue($editPart)
		const isSelected = useValue('selected', () => this.editor.getOnlySelectedShapeId() === shape.id, [])
		const titleRef = useRef<HTMLInputElement>(null)
		const editingTitle = editing && part === 'title'
		const editingBody = editing && part === 'body' && open
		// tldraw can steal focus right after a double-click, so focus the title once editing starts.
		useEffect(() => {
			if (!editingTitle) return
			const id = setTimeout(() => {
				titleRef.current?.focus()
				titleRef.current?.select()
			}, 50)
			return () => clearTimeout(id)
		}, [editingTitle])
		/* eslint-enable react-hooks/rules-of-hooks */

		// The title input must not start tldraw drags/selection or trigger its keyboard shortcuts.
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
					{editingTitle ? (
						<input
							className="collapsible-title-input"
							ref={titleRef}
							value={title}
							onChange={(e) =>
								this.editor.updateShape({ id: shape.id, type: TYPE, props: { title: e.target.value } })
							}
							{...guard}
						/>
					) : (
						<span className="collapsible-title">{title || 'Untitled'}</span>
					)}
				</div>
				{open && (
					<div className="collapsible-body">
						{editingBody ? (
							// tldraw's own rich-text editor: Cmd/Ctrl+B / I / U, and a toolbar on selection.
							<RichTextLabel
								shapeId={shape.id}
								type="collapsible"
								richText={richText}
								font="draw"
								fontSize={20}
								lineHeight={1.4}
								align="start"
								verticalAlign="start"
								labelColor="#1d1d1d"
								isSelected={isSelected}
								wrap
								classNamePrefix="collapsible"
								textWidth={w - 36}
								textHeight={Math.max(40, h - COLLAPSED_H - 16)}
							/>
						) : (
							<div
								className="tl-rich-text collapsible-rich"
								dangerouslySetInnerHTML={{ __html: renderHtmlFromRichText(this.editor, richText) }}
							/>
						)}
					</div>
				)}
			</HTMLContainer>
		)
	}

	indicator(shape: CollapsibleShape) {
		return <rect width={shape.props.w} height={shape.props.open ? shape.props.h : COLLAPSED_H} rx={10} />
	}

	// Used by image / PDF export (the HTML above is not part of SVG export). Plain, no text wrapping.
	override toSvg(shape: CollapsibleShape) {
		const { w, h, title, richText, open } = shape.props
		const height = open ? h : COLLAPSED_H
		return (
			<g fontFamily="sans-serif" fill="#1d1d1d">
				<rect width={w} height={height} rx={10} fill="#fff" stroke="#1d1d1d" strokeWidth={2} />
				<text x={16} y={33} fontSize={22} fontWeight={700}>{`${open ? '▾' : '▸'} ${title}`}</text>
				{open &&
					renderPlaintextFromRichText(this.editor, richText)
						.split('\n')
						.map((line, i) => (
						<text key={i} x={16} y={74 + i * 28} fontSize={20}>
							{line}
						</text>
					))}
			</g>
		)
	}
}
