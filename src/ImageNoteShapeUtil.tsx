import {
	Geometry2d,
	HTMLContainer,
	RecordProps,
	Rectangle2d,
	RichTextLabel,
	ShapeUtil,
	T,
	TLAssetId,
	TLResizeInfo,
	TLRichText,
	TLBaseShape,
	createShapePropsMigrationIds,
	createShapePropsMigrationSequence,
	renderHtmlFromRichText,
	renderPlaintextFromRichText,
	resizeBox,
	richTextValidator,
	toRichText,
	useImageOrVideoAsset,
	useIsEditing,
	useValue,
} from 'tldraw'

const TYPE = 'imagenote' as const
/** Default height of the text area that opens under the image. */
export const NOTE_H = 150
const MIN_NOTE_H = 60
const migrationIds = createShapePropsMigrationIds(TYPE, { NoteHeight: 1 })

export type ImageNoteShape = TLBaseShape<
	typeof TYPE,
	{
		/** Image width; the text area has the same width. */
		w: number
		/** Image height. */
		h: number
		assetId: TLAssetId | null
		richText: TLRichText
		open: boolean
		/** Height of the text area under the image (resizable when open). */
		noteH: number
	}
>

// An image that, when clicked, opens a text box underneath it (click again to close).
//  - click image: toggle (also while presenting)   - double-click: open and edit the text
export class ImageNoteShapeUtil extends ShapeUtil<ImageNoteShape> {
	static override type = TYPE
	static override props: RecordProps<ImageNoteShape> = {
		w: T.number,
		h: T.number,
		assetId: T.string.nullable() as any,
		richText: richTextValidator,
		open: T.boolean,
		noteH: T.number,
	}

	static override migrations = createShapePropsMigrationSequence({
		sequence: [
			{
				id: migrationIds.NoteHeight,
				up(props: any) {
					props.noteH = NOTE_H
				},
				down(props: any) {
					delete props.noteH
				},
			},
		],
	})

	override hideRotateHandle() {
		return true
	}
	override onRotate(initial: ImageNoteShape) {
		return initial
	}

	getDefaultProps(): ImageNoteShape['props'] {
		return { w: 400, h: 300, assetId: null, richText: toRichText('Double-click to edit this text.'), open: false, noteH: NOTE_H }
	}

	private totalH(s: ImageNoteShape) {
		return s.props.h + (s.props.open ? s.props.noteH : 0)
	}

	getGeometry(shape: ImageNoteShape): Geometry2d {
		return new Rectangle2d({ width: shape.props.w, height: this.totalH(shape), isFilled: true })
	}

	override canEdit() {
		return true
	}

	override onClick(shape: ImageNoteShape) {
		const local = this.editor.getPointInShapeSpace(shape, this.editor.inputs.currentPagePoint)
		if (local.y > shape.props.h) return
		return { id: shape.id, type: TYPE, props: { open: !shape.props.open } }
	}

	override onDoubleClick(shape: ImageNoteShape) {
		if (!shape.props.open) this.editor.updateShape({ id: shape.id, type: TYPE, props: { open: true } })
	}

	// Dragging the top/bottom handle of an open note resizes only the text area (image aspect ratio
	// is untouched). Dragging a side or corner handle scales the image (keeping its aspect ratio)
	// and leaves the text area height alone.
	override onResize(shape: ImageNoteShape, info: TLResizeInfo<ImageNoteShape>) {
		const { handle, scaleY } = info
		if (handle === 'bottom' || handle === 'top') {
			if (!shape.props.open) return shape
			const noteH = Math.max(MIN_NOTE_H, Math.round(this.totalH(shape) * Math.abs(scaleY) - shape.props.h))
			return { ...shape, props: { ...shape.props, noteH } }
		}
		const resized = resizeBox(shape, info)
		const w = Math.max(80, resized.props.w)
		const h = (w * shape.props.h) / shape.props.w
		const dy = this.totalH(shape) - (h + (shape.props.open ? shape.props.noteH : 0))
		return {
			...resized,
			y: handle.includes('top') ? shape.y + dy : shape.y,
			props: { ...resized.props, w, h },
		}
	}

	component(shape: ImageNoteShape) {
		const { w, h, assetId, richText, open, noteH } = shape.props
		/* eslint-disable react-hooks/rules-of-hooks */
		const editing = useIsEditing(shape.id)
		const isSelected = useValue('selected', () => this.editor.getOnlySelectedShapeId() === shape.id, [])
		const { url } = useImageOrVideoAsset({ shapeId: shape.id, assetId, width: w })
		const readonly = useValue('readonly', () => this.editor.getInstanceState().isReadonly, [])
		/* eslint-enable react-hooks/rules-of-hooks */

		return (
			<HTMLContainer
				className="imagenote-shape"
				style={{ width: w, height: this.totalH(shape), pointerEvents: 'all' }}
			>
				<div className="imagenote-image" style={{ height: h }}>
					{url ? <img src={url} draggable={false} alt="" /> : null}
				</div>
				{open && (
					<div className="imagenote-body" style={{ height: noteH }}>
						{editing ? (
							<RichTextLabel
								shapeId={shape.id}
								type="imagenote"
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
								textWidth={w - 32}
								textHeight={noteH - 16}
							/>
						) : (
							<div
								className="tl-rich-text collapsible-rich"
								dangerouslySetInnerHTML={{ __html: renderHtmlFromRichText(this.editor, richText) }}
							/>
						)}
					</div>
				)}
				{open && !readonly && (
					// Grip along the bottom edge: drag to change the text area height. tldraw hides its own
					// resize handles while text is being edited, so this works in that state too.
					<div
						className="imagenote-grip"
						title="Drag to resize the text box"
						onPointerDown={(e) => {
							e.stopPropagation()
							e.preventDefault()
							const el = e.currentTarget
							el.setPointerCapture(e.pointerId)
							const startY = e.clientY
							const startH = noteH
							const move = (ev: PointerEvent) => {
								const dy = (ev.clientY - startY) / this.editor.getZoomLevel()
								this.editor.updateShape({
									id: shape.id,
									type: TYPE,
									props: { noteH: Math.max(MIN_NOTE_H, Math.round(startH + dy)) },
								})
							}
							const up = () => {
								el.removeEventListener('pointermove', move)
								el.removeEventListener('pointerup', up)
								el.removeEventListener('pointercancel', up)
							}
							el.addEventListener('pointermove', move)
							el.addEventListener('pointerup', up)
							el.addEventListener('pointercancel', up)
						}}
					/>
				)}
			</HTMLContainer>
		)
	}

	indicator(shape: ImageNoteShape) {
		return <rect width={shape.props.w} height={this.totalH(shape)} />
	}

	override toSvg(shape: ImageNoteShape) {
		const { w, h, open, richText, noteH } = shape.props
		return (
			<g fontFamily="sans-serif" fill="#1d1d1d">
				<SvgImage shape={shape} />
				{open && (
					<>
						<rect y={h} width={w} height={noteH} fill="#fff" stroke="#1d1d1d" strokeWidth={2} />
						{renderPlaintextFromRichText(this.editor, richText)
							.split('\n')
							.map((line, i) => (
								<text key={i} x={14} y={h + 34 + i * 28} fontSize={20}>
									{line}
								</text>
							))}
					</>
				)}
			</g>
		)
	}
}

function SvgImage({ shape }: { shape: ImageNoteShape }) {
	const { url } = useImageOrVideoAsset({ shapeId: shape.id, assetId: shape.props.assetId, width: shape.props.w })
	return url ? <image href={url} width={shape.props.w} height={shape.props.h} /> : null
}
