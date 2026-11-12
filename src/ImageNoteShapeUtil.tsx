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
	TLShape,
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
/** Height of the text area that opens under the image. */
export const NOTE_H = 150

declare module 'tldraw' {
	export interface TLGlobalShapePropsMap {
		[TYPE]: {
			/** Image width; the text area has the same width. */
			w: number
			/** Image height. */
			h: number
			assetId: TLAssetId | null
			richText: TLRichText
			open: boolean
		}
	}
}

export type ImageNoteShape = TLShape<typeof TYPE>

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
	}

	override hideRotateHandle() {
		return true
	}
	override onRotate(initial: ImageNoteShape) {
		return initial
	}

	getDefaultProps(): ImageNoteShape['props'] {
		return { w: 400, h: 300, assetId: null, richText: toRichText('Double-click to edit this text.'), open: false }
	}

	private totalH(s: ImageNoteShape) {
		return s.props.h + (s.props.open ? NOTE_H : 0)
	}

	getGeometry(shape: ImageNoteShape): Geometry2d {
		return new Rectangle2d({ width: shape.props.w, height: this.totalH(shape), isFilled: true })
	}

	override canEdit() {
		return true
	}

	override onClick(shape: ImageNoteShape) {
		const local = this.editor.getPointInShapeSpace(shape, this.editor.inputs.getCurrentPagePoint())
		if (local.y > shape.props.h) return
		return { id: shape.id, type: TYPE, props: { open: !shape.props.open } }
	}

	override onDoubleClick(shape: ImageNoteShape) {
		if (!shape.props.open) this.editor.updateShape({ id: shape.id, type: TYPE, props: { open: true } })
	}

	// Keep the image's aspect ratio; the text area keeps its fixed height.
	override onResize(shape: ImageNoteShape, info: TLResizeInfo<ImageNoteShape>) {
		const resized = resizeBox(shape, info)
		const w = Math.max(80, resized.props.w)
		const h = (w * shape.props.h) / shape.props.w
		const topMoved = info.handle.includes('top')
		const dy = this.totalH(shape) - (h + (shape.props.open ? NOTE_H : 0))
		return {
			...resized,
			y: topMoved ? shape.y + dy : shape.y,
			props: { ...resized.props, w, h },
		}
	}

	component(shape: ImageNoteShape) {
		const { w, h, assetId, richText, open } = shape.props
		/* eslint-disable react-hooks/rules-of-hooks */
		const editing = useIsEditing(shape.id)
		const isSelected = useValue('selected', () => this.editor.getOnlySelectedShapeId() === shape.id, [])
		const { url } = useImageOrVideoAsset({ shapeId: shape.id, assetId, width: w })
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
					<div className="imagenote-body" style={{ height: NOTE_H }}>
						{editing ? (
							<RichTextLabel
								shapeId={shape.id}
								type="imagenote"
								richText={richText}
								fontFamily="var(--tl-font-draw)"
								fontSize={20}
								lineHeight={1.4}
								textAlign="start"
								verticalAlign="start"
								labelColor="#1d1d1d"
								isSelected={isSelected}
								wrap
								classNamePrefix="collapsible"
								textWidth={w - 32}
								textHeight={NOTE_H - 16}
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

	getIndicatorPath(shape: ImageNoteShape) {
		const path = new Path2D()
		path.rect(0, 0, shape.props.w, this.totalH(shape))
		return path
	}

	override toSvg(shape: ImageNoteShape) {
		const { w, h, open, richText } = shape.props
		return (
			<g fontFamily="sans-serif" fill="#1d1d1d">
				<SvgImage shape={shape} />
				{open && (
					<>
						<rect y={h} width={w} height={NOTE_H} fill="#fff" stroke="#1d1d1d" strokeWidth={2} />
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
