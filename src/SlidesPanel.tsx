import { useEffect, useRef, useState } from 'react'
import { stopEventPropagation, track, useEditor, useValue } from 'tldraw'
import { elapsedMs, formatClock } from './presenterProtocol'
import {
	$currentPos,
	$fixedCamera,
	$notesOpen,
	$panelHidden,
	$presenting,
	$targetMinutes,
	$timer,
	enterPresentation,
	getSlideTitle,
	addSequenceVisit,
	moveToPosition,
	moveSequenceEntry,
	removeSequenceEntry,
	openPresenterWindow,
	pauseTimer,
	resetTimer,
	setFixedCamera,
	setPanelHidden,
	setTargetMinutes,
	startTimer,
	useCurrentPos,
	useCurrentSlide,
	useNow,
	useSequence,
} from './presentation'
import { VIEWER } from './viewer'
import { exportDeck, exportPdf, importDeck } from './fileio'

// Side panel in the `HelperButtons` slot: ordered slide list (drag to reorder), speaker notes,
// timer, camera mode and file actions. Hidden entirely in presentation mode.
export const SlidesPanel = track(() => {
	const editor = useEditor()
	const sequence = useSequence()
	const current = useCurrentSlide()
	const currentPos = useCurrentPos()
	const presenting = useValue($presenting)
	const hidden = useValue($panelHidden)
	const notesOpen = useValue($notesOpen)
	const fixed = useValue($fixedCamera)
	const target = useValue($targetMinutes)
	const timer = useValue($timer)
	const now = useNow()
	const selected = useValue('selected ids', () => editor.getSelectedShapeIds(), [editor])
	// Rows are positions in the talk (not slides): the same slide can appear more than once.
	const [dragPos, setDragPos] = useState<number | null>(null)
	const [overPos, setOverPos] = useState<number | null>(null)
	const [busy, setBusy] = useState('')
	const fileInput = useRef<HTMLInputElement>(null)
	const listRef = useRef<HTMLDivElement>(null)

	// Drag-over/drop use native *capture* listeners: tldraw's container stops `drop` events from
	// bubbling to React, so React's onDrop never fires for elements inside the editor.
	const dropRef = useRef<(pos: number) => void>(() => {})
	useEffect(() => {
		const list = listRef.current
		if (!list) return
		const posOf = (e: Event) => {
			const row = (e.target as HTMLElement).closest('[data-pos]') as HTMLElement | null
			return row ? Number(row.dataset.pos) : undefined
		}
		const over = (e: DragEvent) => {
			const pos = posOf(e)
			if (pos === undefined) return
			e.preventDefault()
			setOverPos(pos)
		}
		const drop = (e: DragEvent) => {
			const pos = posOf(e)
			if (pos === undefined) return
			e.preventDefault()
			e.stopPropagation()
			dropRef.current(pos)
			setOverPos(null)
		}
		list.addEventListener('dragover', over, true)
		list.addEventListener('drop', drop, true)
		return () => {
			list.removeEventListener('dragover', over, true)
			list.removeEventListener('drop', drop, true)
		}
	}, [presenting])

	if (presenting) return null
	if (hidden) {
		return (
			<button
				className="slides-panel-tab"
				title="Show slide panel (\)"
				onPointerDown={stopEventPropagation}
				onClick={() => setPanelHidden(false)}
			>
				☰ Slides
			</button>
		)
	}

	const position = current && currentPos >= 0 ? currentPos + 1 : 0
	const elapsed = elapsedMs(timer, now)
	const notesSlide = current ?? sequence[0]

	// The dragged entry takes the dropped-on row's position (so dragging down lands below it).
	const onDrop = (targetPos: number) => {
		if (dragPos === null) return
		moveSequenceEntry(editor, dragPos, targetPos)
		// Keep following the entry we were on if it was the one moved.
		if (currentPos === dragPos) $currentPos.set(targetPos)
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
		<div className="slides-panel" onPointerDown={stopEventPropagation}>
			<div className="slides-status">
				<button className="slides-hide" title="Hide panel (\)" onClick={() => setPanelHidden(true)}>
					‹ Hide
				</button>
				<span>{sequence.length ? `${position || '–'} / ${sequence.length}` : 'No slides'}</span>
				{/* The talk timer is for the presenter; the published viewer doesn't show it. */}
				{!VIEWER && (
					<span className={elapsed > target * 60_000 ? 'over' : ''}>
						{formatClock(elapsed)} / {target}m
					</span>
				)}
			</div>

			<div className="slides-list scroll-light" ref={listRef}>
				{sequence.map((slide, i) => {
					const visits = sequence.filter((s) => s.id === slide.id).length
					const isRepeat = sequence.findIndex((s) => s.id === slide.id) !== i
					return (
						// A draggable <div> (not a <button>: drag inside buttons is unreliable across browsers).
						<div
							key={`${i}-${slide.id}`}
							role="button"
							tabIndex={0}
							draggable={!VIEWER}
							data-pos={i}
							className={'slides-panel-button slides-row' + (overPos === i ? ' drop-target' : '')}
							onClick={() => moveToPosition(editor, i)}
							onDragStart={() => setDragPos(i)}
							onDragEnd={() => {
								setDragPos(null)
								setOverPos(null)
							}}
							style={{
								background: currentPos === i ? 'var(--tl-color-background)' : 'transparent',
								outline: selected.includes(slide.id)
									? 'var(--tl-color-selection-stroke) solid 1.5px'
									: 'none',
							}}
						>
							<b>{i + 1}</b>
							<span className="slides-row-title">
								{isRepeat && <span title="Return visit">↺ </span>}
								{getSlideTitle(editor, slide) || 'Untitled'}
							</span>
							{!VIEWER && visits > 1 && isRepeat && (
								<button
									className="slides-row-btn"
									title="Remove this visit"
									onClick={(e) => {
										e.stopPropagation()
										removeSequenceEntry(editor, i)
									}}
								>
									×
								</button>
							)}
							{!VIEWER && (
							<button
								className="slides-row-btn"
								title="Add another visit to this slide at the end (then drag it into place)"
								onClick={(e) => {
									e.stopPropagation()
									addSequenceVisit(editor, slide.id)
								}}
							>
								↺+
							</button>
							)}
						</div>
					)
				})}
			</div>

			<div className="slides-actions">
				<button onClick={() => enterPresentation(editor)} disabled={!sequence.length}>
					Present (P)
				</button>
				{!VIEWER && <button onClick={() => $notesOpen.set(!notesOpen)}>Notes (N)</button>}
			</div>

			{!VIEWER && notesOpen && (
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

			{!VIEWER && <details className="slides-settings">
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
			</details>}
		</div>
	)
})
