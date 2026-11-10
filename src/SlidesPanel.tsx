import { useEffect, useRef, useState } from 'react'
import { TLShapeId, track, useEditor, useValue } from 'tldraw'
import { elapsedMs, formatClock } from './presenterProtocol'
import {
	$fixedCamera,
	$notesOpen,
	$presenting,
	$targetMinutes,
	$timer,
	enterPresentation,
	getSlideTitle,
	moveToSlide,
	openPresenterWindow,
	pauseTimer,
	reorderSlides,
	resetTimer,
	setFixedCamera,
	setTargetMinutes,
	startTimer,
	useCurrentSlide,
	useNow,
	useSlides,
} from './presentation'
import { exportDeck, exportPdf, importDeck } from './fileio'

// Side panel in the `HelperButtons` slot: ordered slide list (drag to reorder), speaker notes,
// timer, camera mode and file actions. Hidden entirely in presentation mode.
export const SlidesPanel = track(() => {
	const editor = useEditor()
	const slides = useSlides()
	const current = useCurrentSlide()
	const presenting = useValue($presenting)
	const notesOpen = useValue($notesOpen)
	const fixed = useValue($fixedCamera)
	const target = useValue($targetMinutes)
	const timer = useValue($timer)
	const now = useNow()
	const selected = useValue('selected ids', () => editor.getSelectedShapeIds(), [editor])
	const [dragId, setDragId] = useState<TLShapeId | null>(null)
	const [overId, setOverId] = useState<TLShapeId | null>(null)
	const [busy, setBusy] = useState('')
	const fileInput = useRef<HTMLInputElement>(null)
	const listRef = useRef<HTMLDivElement>(null)

	// Drag-over/drop use native *capture* listeners: tldraw's container stops `drop` events from
	// bubbling to React, so React's onDrop never fires for elements inside the editor.
	const dropRef = useRef<(id: TLShapeId) => void>(() => {})
	useEffect(() => {
		const list = listRef.current
		if (!list) return
		const idOf = (e: Event) =>
			((e.target as HTMLElement).closest('[data-slide-id]') as HTMLElement | null)?.dataset.slideId as
				| TLShapeId
				| undefined
		const over = (e: DragEvent) => {
			const id = idOf(e)
			if (!id) return
			e.preventDefault()
			setOverId(id)
		}
		const drop = (e: DragEvent) => {
			const id = idOf(e)
			if (!id) return
			e.preventDefault()
			e.stopPropagation()
			dropRef.current(id)
			setOverId(null)
		}
		list.addEventListener('dragover', over, true)
		list.addEventListener('drop', drop, true)
		return () => {
			list.removeEventListener('dragover', over, true)
			list.removeEventListener('drop', drop, true)
		}
	}, [presenting])

	if (presenting) return null

	const position = current ? slides.findIndex((s) => s.id === current.id) + 1 : 0
	const elapsed = elapsedMs(timer, now)
	const notesSlide = current ?? slides[0]

	const onDrop = (targetId: TLShapeId) => {
		if (!dragId || dragId === targetId) return
		const ids = slides.map((s) => s.id).filter((id) => id !== dragId)
		ids.splice(ids.indexOf(targetId), 0, dragId)
		reorderSlides(editor, ids)
	}

	dropRef.current = onDrop

	const run = async (label: string, fn: () => Promise<void>) => {
		setBusy(label)
		try {
			await fn()
		} catch (e) {
			alert(e instanceof Error ? e.message : String(e))
		} finally {
			setBusy('')
		}
	}

	return (
		<div className="slides-panel" onPointerDown={editor.markEventAsHandled}>
			<div className="slides-status">
				<span>{slides.length ? `${position || '–'} / ${slides.length}` : 'No slides'}</span>
				<span className={elapsed > target * 60_000 ? 'over' : ''}>
					{formatClock(elapsed)} / {target}m
				</span>
			</div>

			<div className="slides-list scroll-light" ref={listRef}>
				{slides.map((slide, i) => (
					// A draggable <div> (not a <button>: drag inside buttons is unreliable across browsers).
					<div
						key={slide.id}
						role="button"
						tabIndex={0}
						draggable
						data-slide-id={slide.id}
						className={'slides-panel-button slides-row' + (overId === slide.id ? ' drop-target' : '')}
						onClick={() => moveToSlide(editor, slide)}
						onDragStart={() => setDragId(slide.id)}
						onDragEnd={() => {
							setDragId(null)
							setOverId(null)
						}}
						style={{
							background: current?.id === slide.id ? 'var(--tl-color-background)' : 'transparent',
							outline: selected.includes(slide.id) ? 'var(--tl-color-selection-stroke) solid 1.5px' : 'none',
						}}
					>
						<b>{i + 1}</b>
						<span className="slides-row-title">{getSlideTitle(editor, slide) || 'Untitled'}</span>
					</div>
				))}
			</div>

			<div className="slides-actions">
				<button onClick={() => enterPresentation(editor)} disabled={!slides.length}>
					Present (P)
				</button>
				<button onClick={() => $notesOpen.set(!notesOpen)}>Notes (N)</button>
			</div>

			{notesOpen && (
				<div className="slides-notes">
					{notesSlide ? (
						<textarea
							key={notesSlide.id}
							placeholder="Speaker notes for this slide (never shown on the projected view)"
							defaultValue={notesSlide.props.notes}
							onChange={(e) =>
								editor.updateShape({ id: notesSlide.id, type: 'slide', props: { notes: e.target.value } })
							}
							onKeyDown={(e) => e.stopPropagation()}
						/>
					) : (
						<em>Create a slide first.</em>
					)}
					<button onClick={openPresenterWindow}>Open notes window</button>
				</div>
			)}

			<details className="slides-settings">
				<summary>Timer, camera, files</summary>
				<div className="slides-actions">
					<button onClick={timer.running ? pauseTimer : startTimer}>{timer.running ? 'Pause' : 'Start'}</button>
					<button onClick={resetTimer}>Reset</button>
				</div>
				<label>
					Target (min){' '}
					<input
						type="number"
						min={1}
						value={target}
						onChange={(e) => setTargetMinutes(Number(e.target.value))}
						onKeyDown={(e) => e.stopPropagation()}
					/>
				</label>
				<label>
					<input type="checkbox" checked={fixed} onChange={(e) => setFixedCamera(editor, e.target.checked)} />{' '}
					Fixed camera (no pan/zoom)
				</label>
				<div className="slides-actions">
					<button disabled={!!busy} onClick={() => run('export', () => exportDeck(editor))}>
						Export .tldr
					</button>
					<button disabled={!!busy} onClick={() => fileInput.current?.click()}>
						Import…
					</button>
					<button
						disabled={!!busy}
						onClick={() => run('pdf', () => exportPdf(editor, (d, t) => setBusy(`PDF ${d}/${t}`)))}
					>
						{busy.startsWith('PDF') ? busy : 'Export PDF'}
					</button>
				</div>
				<input
					ref={fileInput}
					type="file"
					accept=".tldr,application/json"
					hidden
					onChange={(e) => {
						const f = e.target.files?.[0]
						e.target.value = ''
						if (f && confirm('Importing replaces the current deck. Continue?')) {
							run('import', () => importDeck(editor, f))
						}
					}}
				/>
			</details>
		</div>
	)
})
