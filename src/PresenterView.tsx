import { useEffect, useRef, useState } from 'react'
import {
	PRESENTER_CHANNEL,
	PresenterCommand,
	PresenterState,
	PresenterThumbs,
	elapsedMs,
	formatClock,
} from './presenterProtocol'

// Presenter window (opened with `N`, or from the panel). Keep this one off the projector.
// It talks to the deck window over a BroadcastChannel; no tldraw code runs here.
export function PresenterView() {
	const [state, setState] = useState<PresenterState | null>(null)
	const [thumbs, setThumbs] = useState<PresenterThumbs | null>(null)
	const [now, setNow] = useState(Date.now())
	const [notes, setNotes] = useState('')
	const channel = useRef<BroadcastChannel | null>(null)
	const notesEl = useRef<HTMLTextAreaElement>(null)
	const notesFor = useRef<string | null>(null)
	const send = (cmd: PresenterCommand) => channel.current?.postMessage(cmd)

	useEffect(() => {
		document.title = 'Presenter'
		const ch = new BroadcastChannel(PRESENTER_CHANNEL)
		channel.current = ch
		ch.onmessage = (ev: MessageEvent<PresenterState | PresenterThumbs>) => {
			if (ev.data.kind === 'state') setState(ev.data)
			else if (ev.data.kind === 'thumbs') setThumbs(ev.data)
		}
		ch.postMessage({ kind: 'hello' } satisfies PresenterCommand)
		const tick = setInterval(() => setNow(Date.now()), 500)
		const onKey = (e: KeyboardEvent) => {
			const el = e.target as HTMLElement
			if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return
			const post = (c: PresenterCommand) => ch.postMessage(c)
			if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') post({ kind: 'next' })
			else if (e.key === 'ArrowLeft' || e.key === 'PageUp') post({ kind: 'prev' })
			else if (e.key === 'z' || e.key === 'Z') post({ kind: 'overview' })
			else return
			e.preventDefault()
		}
		window.addEventListener('keydown', onKey)
		return () => {
			clearInterval(tick)
			window.removeEventListener('keydown', onKey)
			ch.close()
		}
	}, [])

	// Take notes from the deck window, but never overwrite what is being typed here.
	useEffect(() => {
		if (!state) return
		const typing = document.activeElement === notesEl.current
		if (notesFor.current !== state.currentId || !typing) {
			notesFor.current = state.currentId
			setNotes(state.notes)
		}
	}, [state])

	if (!state) return <div className="presenter presenter-empty">Waiting for the deck window…</div>

	const elapsed = elapsedMs(state.timer, now)
	const target = state.targetMinutes * 60_000
	const over = elapsed > target

	return (
		<div className="presenter">
			<header>
				<div className="presenter-count">
					{state.position} / {state.total}
				</div>
				<div className={'presenter-clock' + (over ? ' over' : '')}>
					{formatClock(elapsed)} <span>/ {formatClock(target)}</span>
				</div>
			</header>

			<div className="presenter-controls">
				<button onClick={() => send({ kind: 'prev' })}>← Prev</button>
				<button onClick={() => send({ kind: 'next' })}>Next →</button>
				<button className={state.overview ? 'on' : ''} onClick={() => send({ kind: 'overview' })}>
					{state.overview ? 'Back to slide (Z)' : 'Whole canvas (Z)'}
				</button>
				<button onClick={() => send({ kind: 'timer', action: state.timer.running ? 'pause' : 'start' })}>
					{state.timer.running ? 'Pause timer' : 'Start timer'}
				</button>
				<button onClick={() => send({ kind: 'timer', action: 'reset' })}>Reset</button>
			</div>

			<div className="presenter-thumbs">
				<figure>
					<figcaption>Now</figcaption>
					{thumbs?.current ? <img src={thumbs.current} alt="Current slide" /> : <div className="blank" />}
				</figure>
				<figure>
					<figcaption>Next{state.nextTitle ? `: ${state.nextTitle}` : ''}</figcaption>
					{thumbs?.next ? <img src={thumbs.next} alt="Next slide" /> : <div className="blank" />}
				</figure>
				<button className="thumb-refresh" title="Re-render thumbnails" onClick={() => send({ kind: 'refreshThumbs' })}>
					↻
				</button>
			</div>

			<h1>{state.title || `Slide ${state.position}`}</h1>
			<textarea
				ref={notesEl}
				className="presenter-notes"
				placeholder={state.currentId ? 'Notes for this slide (edits save to the deck)' : 'No slide selected'}
				disabled={!state.currentId}
				value={notes}
				onChange={(e) => {
					setNotes(e.target.value)
					if (state.currentId) send({ kind: 'notes', id: state.currentId, text: e.target.value })
				}}
			/>

			<nav className="presenter-list">
				{state.slides.map((s, i) => (
					<button
						key={s.id}
						className={s.id === state.currentId ? 'current' : ''}
						onClick={() => send({ kind: 'goto', id: s.id })}
					>
						<b>{i + 1}</b> {s.title}
					</button>
				))}
			</nav>
		</div>
	)
}
