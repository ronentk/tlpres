import { useEffect, useRef, useState } from 'react'
import {
	PRESENTER_CHANNEL,
	PresenterCommand,
	PresenterState,
	elapsedMs,
	formatClock,
} from './presenterProtocol'

// Speaker-notes window (opened with `N` while presenting, or from the panel).
// Runs in its own window, so keep this one off the projector. It talks to the deck window over a
// BroadcastChannel; no tldraw code runs here.
export function PresenterView() {
	const [state, setState] = useState<PresenterState | null>(null)
	const [now, setNow] = useState(Date.now())
	const channel = useRef<BroadcastChannel | null>(null)

	useEffect(() => {
		document.title = 'Speaker notes'
		const ch = new BroadcastChannel(PRESENTER_CHANNEL)
		channel.current = ch
		ch.onmessage = (ev: MessageEvent<PresenterState>) => {
			if (ev.data.kind === 'state') setState(ev.data)
		}
		ch.postMessage({ kind: 'hello' } satisfies PresenterCommand)
		const tick = setInterval(() => setNow(Date.now()), 500)
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'ArrowRight' || e.key === 'PageDown') send({ kind: 'next' })
			if (e.key === 'ArrowLeft' || e.key === 'PageUp') send({ kind: 'prev' })
		}
		const send = (cmd: PresenterCommand) => ch.postMessage(cmd)
		window.addEventListener('keydown', onKey)
		return () => {
			clearInterval(tick)
			window.removeEventListener('keydown', onKey)
			ch.close()
		}
	}, [])

	const send = (cmd: PresenterCommand) => channel.current?.postMessage(cmd)

	if (!state) {
		return <div className="presenter presenter-empty">Waiting for the deck window…</div>
	}

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
			<h1>{state.title || `Slide ${state.position}`}</h1>
			<pre className="presenter-notes">{state.notes || 'No notes for this slide.'}</pre>
			<section className="presenter-next">
				<h2>Next{state.nextTitle ? `: ${state.nextTitle}` : ''}</h2>
				{state.nextNotes && <pre>{state.nextNotes}</pre>}
			</section>
			<footer>
				<button onClick={() => send({ kind: 'prev' })}>← Previous</button>
				<button onClick={() => send({ kind: 'next' })}>Next →</button>
			</footer>
		</div>
	)
}
