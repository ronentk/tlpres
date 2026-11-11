// Messages exchanged between the main deck window and the speaker-notes window
// over a same-origin BroadcastChannel. No tldraw imports here so the notes window stays light.

export const PRESENTER_CHANNEL = 'tlpres-presenter'

export interface TimerState {
	running: boolean
	/** Date.now() when the current run started (only meaningful while running). */
	startedAt: number
	/** Milliseconds accumulated across previous runs. */
	accumulated: number
}

export interface SlideSummary {
	id: string
	title: string
}

export interface PresenterState {
	kind: 'state'
	slides: SlideSummary[]
	currentId: string | null
	/** 0-based position in the sequence (the same slide can appear at several positions). */
	currentPos: number
	overview: boolean
	presenting: boolean
	/** 1-based position of the current slide, 0 if there is none. */
	position: number
	total: number
	title: string
	notes: string
	nextTitle: string
	nextNotes: string
	timer: TimerState
	targetMinutes: number
}

/** Thumbnails (JPEG data URLs) of the current and next slide; sent separately because they're big. */
export interface PresenterThumbs {
	kind: 'thumbs'
	current: string | null
	next: string | null
}

export type PresenterCommand =
	| { kind: 'next' }
	| { kind: 'prev' }
	| { kind: 'hello' }
	| { kind: 'goto'; pos: number }
	| { kind: 'overview' }
	| { kind: 'timer'; action: 'start' | 'pause' | 'reset' }
	| { kind: 'notes'; id: string; text: string }
	| { kind: 'refreshThumbs' }

export function elapsedMs(timer: TimerState, now = Date.now()) {
	return timer.accumulated + (timer.running ? now - timer.startedAt : 0)
}

export function formatClock(ms: number) {
	const total = Math.max(0, Math.floor(ms / 1000))
	const h = Math.floor(total / 3600)
	const m = Math.floor((total % 3600) / 60)
	const s = total % 60
	const mm = String(m).padStart(2, '0')
	const ss = String(s).padStart(2, '0')
	return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
