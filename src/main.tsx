import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PresenterView } from './PresenterView.tsx'

// `#notes` opens the speaker-notes window instead of the deck.
// (No <StrictMode>: its double-mount fights tldraw's editor lifecycle in dev.)
const isNotesWindow = location.hash === '#notes'
createRoot(document.getElementById('root')!).render(isNotesWindow ? <PresenterView /> : <App />)
