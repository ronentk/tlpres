// Viewer mode: a read-only copy of the deck for publishing on the web. Enabled at build time with
// VITE_VIEWER=1, or at runtime by adding `?view` to the URL (handy for testing).
export const VIEWER =
	import.meta.env.VITE_VIEWER === '1' || new URLSearchParams(location.search).has('view')
