import { Editor, parseTldrawJsonFile, serializeTldrawJsonBlob } from 'tldraw'
import { $currentSlideId, getSlides, moveToSlide } from './presentation'
import type { SlideShape } from './SlideShapeUtil'

function download(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = filename
	document.body.appendChild(a)
	a.click()
	a.remove()
	setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function stamp() {
	return new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
}

/** Save the whole document (all shapes, images, slide order and notes) as a .tldr backup. */
export async function exportDeck(editor: Editor) {
	const blob = await serializeTldrawJsonBlob(editor)
	download(blob, `deck-${stamp()}.tldr`)
}

/** Replace the current document with the contents of a .tldr file. */
export async function importDeck(editor: Editor, file: File) {
	const json = await file.text()
	const result = parseTldrawJsonFile({ json, schema: editor.store.schema })
	if (!result.ok) {
		throw new Error(`Could not read that file (${result.error.type}).`)
	}
	editor.loadSnapshot(result.value.getStoreSnapshot())
	$currentSlideId.set(null)
	const first = getSlides(editor)[0]
	if (first) moveToSlide(editor, first, { animate: false })
	else editor.zoomToFit({ animation: { duration: 0 } })
}

/**
 * If the browser has no saved deck yet, try the deck shipped with the site (`public/deck.tldr`).
 * Returns false when there is no such file (or it can't be parsed), so the caller can fall back.
 */
export async function loadShippedDeck(editor: Editor): Promise<boolean> {
	try {
		const res = await fetch(`${import.meta.env.BASE_URL}deck.tldr`, { cache: 'no-cache' })
		if (!res.ok) return false
		const result = parseTldrawJsonFile({ json: await res.text(), schema: editor.store.schema })
		if (!result.ok) return false // e.g. the dev server answers a missing file with index.html
		editor.loadSnapshot(result.value.getStoreSnapshot())
		return getSlides(editor).length > 0
	} catch {
		return false
	}
}

export function blobToDataUrl(blob: Blob) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(reader.result as string)
		reader.onerror = () => reject(reader.error)
		reader.readAsDataURL(blob)
	})
}

/** Render a slide's area (everything overlapping its frame, minus slide frames) to a JPEG blob. */
export async function renderSlide(editor: Editor, slide: SlideShape, pixelRatio: number, quality: number) {
	const bounds = editor.getShapePageBounds(slide.id)
	if (!bounds) return null
	const content = editor
		.getCurrentPageShapes()
		.filter((s) => s.type !== 'slide' && editor.getShapePageBounds(s.id)?.collides(bounds))
	if (!content.length) return null
	const image = await editor.toImage(content, {
		format: 'jpeg',
		quality,
		bounds,
		padding: 0,
		background: true,
		darkMode: false,
		pixelRatio,
	})
	return image.blob
}

/** One PDF page per slide, in presentation order. Renders each slide's area via tldraw's image export. */
export async function exportPdf(editor: Editor, onProgress?: (done: number, total: number) => void) {
	const slides = getSlides(editor)
	if (!slides.length) throw new Error('There are no slides to export.')
	// Loaded on demand so it doesn't weigh down the main bundle.
	const { jsPDF } = await import('jspdf')
	let pdf: InstanceType<typeof jsPDF> | null = null

	for (let i = 0; i < slides.length; i++) {
		const slide = slides[i]
		const { w, h } = slide.props
		if (!pdf) {
			pdf = new jsPDF({ unit: 'px', format: [w, h], orientation: w >= h ? 'landscape' : 'portrait', hotfixes: ['px_scaling'] })
		} else {
			pdf.addPage([w, h], w >= h ? 'landscape' : 'portrait')
		}

		const blob = await renderSlide(editor, slide, 1.25, 0.85)
		if (blob) pdf.addImage(await blobToDataUrl(blob), 'JPEG', 0, 0, w, h, undefined, 'FAST')
		onProgress?.(i + 1, slides.length)
	}
	pdf!.save(`deck-${stamp()}.pdf`)
}
