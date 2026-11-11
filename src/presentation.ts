import { useEffect, useState } from 'react'
import {
	EASINGS,
	Editor,
	TLShapeId,
	atom,
	react,
	renderPlaintextFromRichText,
	useEditor,
	useValue,
} from 'tldraw'
import {
	PRESENTER_CHANNEL,
	PresenterCommand,
	PresenterState,
	PresenterThumbs,
	TimerState,
	elapsedMs,
} from './presenterProtocol'
import { blobToDataUrl, renderSlide } from './fileio'
import type { SlideShape } from './SlideShapeUtil'

export const TRANSITION_MS = 500

// ---------------------------------------------------------------------------
// Persisted settings (localStorage; these are per-browser, not part of the .tldr document)
// ---------------------------------------------------------------------------

function loadSetting<T>(key: string, fallback: T): T {
	try {
		const raw = localStorage.getItem('tlpres:' + key)
		return raw === null ? fallback : (JSON.parse(raw) as T)
	} catch {
		return fallback
	}
}
function saveSetting(key: string, value: unknown) {
	try {
		localStorage.setItem('tlpres:' + key, JSON.stringify(value))
	} catch {
		// storage unavailable: setting just won't persist
	}
}

// ---------------------------------------------------------------------------
// UI state (tldraw `atom`s so React can subscribe with `useValue`)
// ---------------------------------------------------------------------------

export const $presenting = atom('presenting', false)
/** In presentation mode: zoomed out to show the whole canvas ("Z"). */
export const $overview = atom('overview', false)
/** True once the camera has finished moving to the current slide (used to fade in the letterbox). */
export const $settled = atom('settled', true)
export const $currentSlideId = atom<TLShapeId | null>('current slide id', null)
/** Position in the talk sequence (the same slide can appear at several positions). -1 = none yet. */
export const $currentPos = atom('current position', -1)
/** Left slide-list panel hidden in edit mode (remembered per browser). */
export const $panelHidden = atom('panel hidden', loadSetting('panelHidden', false))
export function setPanelHidden(hidden: boolean) {
	$panelHidden.set(hidden)
	saveSetting('panelHidden', hidden)
}

export const $notesOpen = atom('notes open', false)
export const $fixedCamera = atom('fixed camera', loadSetting('fixedCamera', false))
export const $targetMinutes = atom('target minutes', loadSetting('targetMinutes', 40))
export const $timer = atom<TimerState>('timer', { running: false, startedAt: 0, accumulated: 0 })

export function setTargetMinutes(minutes: number) {
	const v = Math.max(1, Math.round(minutes) || 40)
	$targetMinutes.set(v)
	saveSetting('targetMinutes', v)
}

export function setFixedCamera(editor: Editor, value: boolean) {
	$fixedCamera.set(value)
	saveSetting('fixedCamera', value)
	applyCameraMode(editor)
}

/**
 * The camera is locked (no user pan/zoom) while presenting, or in "fixed camera" mode.
 * Our own moves pass `force: true`, which tldraw requires to move a locked camera.
 */
export function applyCameraMode(editor: Editor) {
	editor.setCameraOptions({ isLocked: $presenting.get() || $fixedCamera.get() })
}

// ---------------------------------------------------------------------------
// Timer
// ---------------------------------------------------------------------------

export function startTimer() {
	const t = $timer.get()
	if (!t.running) $timer.set({ ...t, running: true, startedAt: Date.now() })
}
export function pauseTimer() {
	const t = $timer.get()
	if (t.running) $timer.set({ running: false, startedAt: 0, accumulated: elapsedMs(t) })
}
export function resetTimer() {
	$timer.set({ running: false, startedAt: 0, accumulated: 0 })
}

/** Re-renders once a second; returns Date.now(). */
export function useNow(intervalMs = 1000) {
	const [now, setNow] = useState(() => Date.now())
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), intervalMs)
		return () => clearInterval(id)
	}, [intervalMs])
	return now
}

// ---------------------------------------------------------------------------
// Slide order. Two layers:
//  - `props.index` gives every slide a base order (new slides get the next number).
//  - The *sequence* (saved in the page's `meta.sequence`, so it travels with the .tldr file) is
//    the order of the talk. It can list a slide more than once, to return to it later.
// Slides missing from the saved sequence (new slides, or old decks) are appended in index order.
// ---------------------------------------------------------------------------

function slidesByIndex(editor: Editor): SlideShape[] {
	return (editor.getCurrentPageShapes().filter((s) => s.type === 'slide') as SlideShape[]).sort(
		(a, b) => a.props.index - b.props.index || a.x - b.x || (a.id < b.id ? -1 : 1)
	)
}

/** The talk, in order, with repeats. */
export function getSequence(editor: Editor): SlideShape[] {
	const bySlide = new Map(slidesByIndex(editor).map((s) => [s.id as string, s]))
	const saved = editor.getCurrentPage().meta.sequence
	const seq: SlideShape[] = []
	if (Array.isArray(saved)) {
		for (const id of saved) {
			const slide = typeof id === 'string' ? bySlide.get(id) : undefined
			if (slide) seq.push(slide)
		}
	}
	const present = new Set(seq.map((s) => s.id))
	for (const slide of bySlide.values()) if (!present.has(slide.id)) seq.push(slide)
	return seq
}

/** Each slide once, ordered by its first appearance in the sequence. */
export function getSlides(editor: Editor): SlideShape[] {
	const seen = new Set<string>()
	return getSequence(editor).filter((s) => !seen.has(s.id) && !!seen.add(s.id))
}

export function setSequence(editor: Editor, ids: string[]) {
	const page = editor.getCurrentPage()
	editor.updatePage({ id: page.id, meta: { ...page.meta, sequence: ids } })
}

export function useSequence() {
	const editor = useEditor()
	return useValue<SlideShape[]>('slide sequence', () => getSequence(editor), [editor])
}

export function useSlides() {
	const editor = useEditor()
	return useValue<SlideShape[]>('slide shapes', () => getSlides(editor), [editor])
}

export function useCurrentPos() {
	return useValue($currentPos)
}

export function useCurrentSlide() {
	const editor = useEditor()
	return useValue<SlideShape | null>(
		'current slide',
		() => {
			const id = $currentSlideId.get()
			return (id && (editor.getShape(id) as SlideShape | undefined)) || null
		},
		[editor]
	)
}

/** The current position, repaired if the sequence changed under it (reorder, deletion). */
export function resolveCurrentPos(editor: Editor): number {
	const seq = getSequence(editor)
	const pos = $currentPos.get()
	const id = $currentSlideId.get()
	if (pos >= 0 && seq[pos]?.id === id) return pos
	return id ? seq.findIndex((s) => s.id === id) : -1
}

export function nextSlideIndex(editor: Editor) {
	return slidesByIndex(editor).reduce((max, s) => Math.max(max, s.props.index), 0) + 1
}

/** Move the entry at `from` so it ends up at position `to`. */
export function moveSequenceEntry(editor: Editor, from: number, to: number) {
	const ids = getSequence(editor).map((s) => s.id as string)
	if (from === to || from < 0 || from >= ids.length || to < 0 || to >= ids.length) return
	const [moved] = ids.splice(from, 1)
	ids.splice(to, 0, moved)
	setSequence(editor, ids)
}

/** Add another visit to a slide at the end of the talk (drag it where you want it). */
export function addSequenceVisit(editor: Editor, slideId: string) {
	setSequence(editor, [...getSequence(editor).map((s) => s.id as string), slideId])
}

/** Remove one visit. The last visit of a slide can't be removed. */
export function removeSequenceEntry(editor: Editor, pos: number) {
	const ids = getSequence(editor).map((s) => s.id as string)
	if (ids.indexOf(ids[pos]) === ids.lastIndexOf(ids[pos])) return
	ids.splice(pos, 1)
	setSequence(editor, ids)
}

/** A readable label: the first line of the top-left-most text on the slide. */
export function getSlideTitle(editor: Editor, slide: SlideShape): string {
	const b = editor.getShapePageBounds(slide.id)
	if (!b) return ''
	const texts = editor
		.getCurrentPageShapes()
		.filter((s) => {
			if (s.id === slide.id || s.type === 'collapsible' || !('richText' in s.props)) return false
			const sb = editor.getShapePageBounds(s.id)
			return !!sb && b.containsPoint(sb.center)
		})
		.sort((a, c) => a.y - c.y || a.x - c.x)
	for (const s of texts) {
		const plain = renderPlaintextFromRichText(editor, (s.props as any).richText).trim()
		if (plain) return plain.split('\n')[0]
	}
	return ''
}

// ---------------------------------------------------------------------------
// Camera navigation
// ---------------------------------------------------------------------------

let settleToken = 0

/**
 * Fly the camera to a slide. `pos` says which visit of the slide this is; by default we stay on the
 * current position if it is this slide, otherwise use its first visit.
 */
export function moveToSlide(
	editor: Editor,
	slide: SlideShape,
	opts: { animate?: boolean; pos?: number } = {}
) {
	const bounds = editor.getShapePageBounds(slide.id)
	if (!bounds) return
	const animate = opts.animate ?? true
	const seq = getSequence(editor)
	const current = $currentPos.get()
	$currentPos.set(
		opts.pos !== undefined
			? opts.pos
			: seq[current]?.id === slide.id
				? current
				: seq.findIndex((s) => s.id === slide.id)
	)
	$currentSlideId.set(slide.id)
	$overview.set(false)
	$settled.set(false)
	const token = ++settleToken
	editor.selectNone()
	editor.stopCameraAnimation()
	editor.zoomToBounds(bounds, {
		inset: 0, // fill the viewport; the aspect-ratio mismatch becomes the letterbox
		force: true, // required to move a locked camera
		animation: animate ? { duration: TRANSITION_MS, easing: EASINGS.easeInOutCubic } : undefined,
	})
	setTimeout(() => {
		if (token === settleToken) $settled.set(true)
	}, animate ? TRANSITION_MS + 60 : 0)
}

export function moveToPosition(editor: Editor, pos: number, opts: { animate?: boolean } = {}) {
	const slide = getSequence(editor)[pos]
	if (slide) moveToSlide(editor, slide, { ...opts, pos })
}

function currentSlide(editor: Editor): SlideShape | null {
	const id = $currentSlideId.get()
	return (id && (editor.getShape(id) as SlideShape | undefined)) || null
}

/** Move one step through the talk sequence (dir = +1 / -1). */
export function stepSlide(editor: Editor, dir: 1 | -1) {
	const seq = getSequence(editor)
	if (!seq.length) return
	const pos = resolveCurrentPos(editor)
	const target = pos < 0 ? 0 : Math.min(seq.length - 1, Math.max(0, pos + dir))
	// Also re-fits when we are already on the first/last slide or coming back from the overview.
	moveToPosition(editor, target)
}

export function goToSlideAt(editor: Editor, which: 'first' | 'last') {
	const seq = getSequence(editor)
	if (seq.length) moveToPosition(editor, which === 'first' ? 0 : seq.length - 1)
}

// ---------------------------------------------------------------------------
// Presentation mode
// ---------------------------------------------------------------------------

export function enterPresentation(editor: Editor) {
	const slides = getSlides(editor)
	if (!slides.length) return
	$presenting.set(true)
	$overview.set(false)
	editor.selectNone()
	editor.updateInstanceState({ isReadonly: true })
	applyCameraMode(editor)
	if (elapsedMs($timer.get()) === 0) startTimer()

	const pos = resolveCurrentPos(editor)
	if (pos >= 0) return moveToPosition(editor, pos)
	// No current slide yet: pick the one closest to what the camera is looking at.
	const c = editor.getViewportPageBounds().center
	const dist = (p: SlideShape) => {
		const sc = editor.getShapePageBounds(p.id)!.center
		return (sc.x - c.x) ** 2 + (sc.y - c.y) ** 2
	}
	moveToSlide(editor, slides.reduce((best, s) => (dist(s) < dist(best) ? s : best)))
}

export function exitPresentation(editor: Editor) {
	const wasOverview = $overview.get()
	$presenting.set(false)
	$overview.set(false)
	$settled.set(true)
	editor.updateInstanceState({ isReadonly: false })
	applyCameraMode(editor)
	const cur = currentSlide(editor)
	if (wasOverview && cur) moveToSlide(editor, cur)
}

export function togglePresentation(editor: Editor) {
	if ($presenting.get()) exitPresentation(editor)
	else enterPresentation(editor)
}

/** "Show the big map": zoom out to the whole canvas and back. Disabled in fixed-camera mode. */
export function toggleOverview(editor: Editor) {
	if (!$presenting.get() || $fixedCamera.get()) return
	const cur = currentSlide(editor)
	if ($overview.get()) {
		if (cur) moveToSlide(editor, cur)
		return
	}
	const bounds = editor.getCurrentPageBounds()
	if (!bounds) return
	$overview.set(true)
	editor.stopCameraAnimation()
	editor.zoomToBounds(bounds, {
		inset: 48,
		force: true,
		animation: { duration: TRANSITION_MS + 150, easing: EASINGS.easeInOutCubic },
	})
}

/** Re-fit instantly after the window is resized so the slide still fills the viewport. */
function refit(editor: Editor) {
	if (!$presenting.get()) return
	if ($overview.get()) {
		const bounds = editor.getCurrentPageBounds()
		if (bounds) editor.zoomToBounds(bounds, { inset: 48, force: true })
		return
	}
	const cur = currentSlide(editor)
	const bounds = cur && editor.getShapePageBounds(cur.id)
	if (bounds) editor.zoomToBounds(bounds, { inset: 0, force: true })
}

// ---------------------------------------------------------------------------
// Speaker-notes window
// ---------------------------------------------------------------------------

export function openPresenterWindow() {
	window.open(
		`${location.origin}${location.pathname}#notes`,
		'tlpres-notes',
		'popup=yes,width=560,height=760'
	)
}

// ---------------------------------------------------------------------------
// Wiring: keyboard, resize, side effects, presenter sync. Returns a cleanup function.
// ---------------------------------------------------------------------------

export function installPresentationControls(editor: Editor) {
	// New / pasted / duplicated slides get the next free order index (0 means "unassigned").
	const stopSideEffect = editor.sideEffects.registerBeforeCreateHandler('shape', (shape) => {
		if (shape.type !== 'slide') return shape
		const slide = shape as SlideShape
		const taken = getSlides(editor).some((s) => s.props.index === slide.props.index)
		if (slide.props.index > 0 && !taken) return shape
		return { ...slide, props: { ...slide.props, index: nextSlideIndex(editor) } }
	})

	// We handle keys ourselves in the *capture* phase so they work with the tldraw UI hidden and
	// win over tldraw's built-in shortcuts (arrow-key nudging, `P` = pen, etc.).
	const onKeyDown = (e: KeyboardEvent) => {
		if (e.metaKey || e.ctrlKey || e.altKey) return
		const el = e.target as HTMLElement | null
		if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
		if (editor.getEditingShapeId()) return

		const presenting = $presenting.get()
		let handled = true
		switch (e.key) {
			case 'p':
			case 'P':
				if (!e.repeat) togglePresentation(editor)
				break
			case 'Escape':
				if (presenting) exitPresentation(editor)
				else handled = false
				break
			case 'z':
			case 'Z':
				if (presenting) {
					if (!e.repeat) toggleOverview(editor)
				} else handled = false // outside presentation, leave tldraw's own Z/Shift+Z alone
				break
			case '\\':
				if (!e.repeat && !presenting) setPanelHidden(!$panelHidden.get())
				else if (!presenting) break
				else handled = false
				break
			case 'n':
			case 'N':
				if (e.repeat) break
				if (presenting) openPresenterWindow()
				else $notesOpen.set(!$notesOpen.get())
				break
			case 'PageDown':
				stepSlide(editor, 1)
				break
			case 'PageUp':
				stepSlide(editor, -1)
				break
			case 'ArrowRight':
			case 'ArrowLeft':
				// In edit mode, arrows still nudge a selection; with nothing selected they navigate.
				if (!presenting && editor.getSelectedShapeIds().length > 0) {
					handled = false
					break
				}
				stepSlide(editor, e.key === 'ArrowRight' ? 1 : -1)
				break
			case 'ArrowDown':
			case ' ':
			case 'Enter':
				if (presenting) stepSlide(editor, 1)
				else handled = false
				break
			case 'ArrowUp':
			case 'Backspace':
				if (presenting) stepSlide(editor, -1)
				else handled = false
				break
			case 'Home':
				if (presenting) goToSlideAt(editor, 'first')
				else handled = false
				break
			case 'End':
				if (presenting) goToSlideAt(editor, 'last')
				else handled = false
				break
			default:
				handled = false
		}
		if (handled) {
			e.preventDefault()
			e.stopPropagation()
			e.stopImmediatePropagation()
		}
	}
	window.addEventListener('keydown', onKeyDown, { capture: true })

	const onResize = () => refit(editor)
	window.addEventListener('resize', onResize)

	// Presenter window sync.
	let channel: BroadcastChannel | null = null
	let latest: PresenterState | null = null
	let latestThumbs: PresenterThumbs | null = null

	// Thumbnails of the current and next slide for the presenter window. Rendering is async, so a
	// token drops results that were superseded by a newer slide change.
	let thumbToken = 0
	const sendThumbs = async () => {
		const token = ++thumbToken
		const slides = getSequence(editor)
		const index = resolveCurrentPos(editor)
		const toUrl = async (slide?: SlideShape) => {
			const blob = slide && (await renderSlide(editor, slide, 0.3, 0.7))
			return blob ? blobToDataUrl(blob) : null
		}
		try {
			const [current, next] = await Promise.all([toUrl(slides[index]), toUrl(slides[index + 1])])
			if (token !== thumbToken) return
			latestThumbs = { kind: 'thumbs', current, next }
			channel?.postMessage(latestThumbs)
		} catch {
			// a failed thumbnail just leaves the previous one in place
		}
	}
	let thumbTimer: ReturnType<typeof setTimeout> | undefined
	const scheduleThumbs = (delay: number) => {
		clearTimeout(thumbTimer)
		thumbTimer = setTimeout(() => void sendThumbs(), delay)
	}
	let lastPos = -2
		if (typeof BroadcastChannel !== 'undefined') {
		channel = new BroadcastChannel(PRESENTER_CHANNEL)
		channel.onmessage = (ev: MessageEvent<PresenterCommand>) => {
			const cmd = ev.data
			switch (cmd.kind) {
				case 'next':
					return stepSlide(editor, 1)
				case 'prev':
					return stepSlide(editor, -1)
				case 'hello':
					if (latest) channel?.postMessage(latest)
					if (latestThumbs) channel?.postMessage(latestThumbs)
					return
				case 'goto':
					return moveToPosition(editor, cmd.pos)
				case 'overview':
					if (!$presenting.get()) {
						// Not presenting: just show the whole canvas, or return to the current slide.
						const cur = currentSlide(editor)
						if ($overview.get() && cur) return moveToSlide(editor, cur)
						$overview.set(true)
						return editor.zoomToFit({ force: true, animation: { duration: TRANSITION_MS } })
					}
					return toggleOverview(editor)
				case 'timer':
					return cmd.action === 'start' ? startTimer() : cmd.action === 'pause' ? pauseTimer() : resetTimer()
				case 'notes':
					if (editor.getShape(cmd.id as TLShapeId)) {
						// Presenting sets the editor read-only, which blocks updates; lift it for this one write.
						const readonly = editor.getInstanceState().isReadonly
						if (readonly) editor.updateInstanceState({ isReadonly: false })
						editor.updateShape({ id: cmd.id as TLShapeId, type: 'slide', props: { notes: cmd.text } })
						if (readonly) editor.updateInstanceState({ isReadonly: true })
					}
					return
				case 'refreshThumbs':
					return void sendThumbs()
			}
		}
	}
	const stopPublish = react('publish presenter state', () => {
		const slides = getSequence(editor)
		const id = $currentSlideId.get()
		const index = resolveCurrentPos(editor)
		$currentPos.get() // re-publish when the position changes (the same slide can repeat)
		const cur = slides[index]
		const next = slides[index + 1]
		if (index !== lastPos) {
			lastPos = index
			scheduleThumbs(TRANSITION_MS + 100) // after the camera settles
		}
		latest = {
			kind: 'state',
			slides: slides.map((s) => ({ id: s.id, title: getSlideTitle(editor, s) || 'Untitled' })),
			currentId: id,
			currentPos: index,
			overview: $overview.get(),
			presenting: $presenting.get(),
			position: index + 1,
			total: slides.length,
			title: cur ? getSlideTitle(editor, cur) : '',
			notes: cur?.props.notes ?? '',
			nextTitle: next ? getSlideTitle(editor, next) : '',
			nextNotes: next?.props.notes ?? '',
			timer: $timer.get(),
			targetMinutes: $targetMinutes.get(),
		}
		channel?.postMessage(latest)
	})

	// Content edits (in edit mode) refresh the thumbnails, debounced.
	const stopStoreListen = editor.store.listen(() => scheduleThumbs(1500), {
		source: 'user',
		scope: 'document',
	})

	return () => {
		clearTimeout(thumbTimer)
		stopStoreListen()
		stopSideEffect()
		stopPublish()
		window.removeEventListener('keydown', onKeyDown, { capture: true })
		window.removeEventListener('resize', onResize)
		channel?.close()
	}
}
