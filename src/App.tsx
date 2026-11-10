import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
	DefaultKeyboardShortcutsDialog,
	DefaultKeyboardShortcutsDialogContent,
	DefaultToolbar,
	DefaultToolbarContent,
	Editor,
	TLComponents,
	TLUiOverrides,
	Tldraw,
	TldrawUiMenuItem,
	useEditor,
	useIsToolSelected,
	useTools,
	useValue,
} from 'tldraw'
import 'tldraw/tldraw.css'
import { getAssetUrlsByMetaUrl } from '@tldraw/assets/urls'
import { SlideShapeTool } from './SlideShapeTool'
import { SlideShapeUtil } from './SlideShapeUtil'
import { SlidesPanel } from './SlidesPanel'
import {
	$overview,
	$presenting,
	$settled,
	$currentSlideId,
	applyCameraMode,
	getSlides,
	installPresentationControls,
	moveToSlide,
	stepSlide,
} from './presentation'
import { loadShippedDeck } from './fileio'
import { createStarterDeck } from './starterDeck'
import './slides.css'

// Bundle fonts/icons/translations with the build (no CDN), so the deck works offline.
const assetUrls = getAssetUrlsByMetaUrl()

// Hobby license key from .env.local; empty is fine for local dev.
const licenseKey = import.meta.env.VITE_TLDRAW_LICENSE_KEY || undefined

// While presenting we use `hideUi`, which renders only this slot: a letterbox that masks
// everything outside the current slide (the camera fits the slide to the viewport width/height).
function PresentationOverlay() {
	const editor = useEditor()
	const presenting = useValue($presenting)
	const overview = useValue($overview)
	const settled = useValue($settled)
	const rect = useValue(
		'slide screen rect',
		() => {
			const id = $currentSlideId.get()
			const b = id && editor.getShapePageBounds(id)
			if (!b) return null
			const tl = editor.pageToViewport({ x: b.minX, y: b.minY })
			const br = editor.pageToViewport({ x: b.maxX, y: b.maxY })
			return { l: tl.x, t: tl.y, r: br.x, b: br.y }
		},
		[editor]
	)
	if (!presenting || overview || !rect) return null
	const vp = editor.getViewportScreenBounds()
	const style = { opacity: settled ? 1 : 0 }
	// Rendered through a portal into the editor container at z-index 247: above the canvas but
	// *below* tldraw's watermark (layer 248), which must always stay visible. (The in-front slot
	// is a stacking context at 250, which would cover it.)
	return createPortal(
		<div className="letterbox" style={style}>
			<div style={{ left: 0, top: 0, width: vp.w, height: Math.max(0, rect.t) }} />
			<div style={{ left: 0, top: rect.b, width: vp.w, height: Math.max(0, vp.h - rect.b) }} />
			<div style={{ left: 0, top: rect.t, width: Math.max(0, rect.l), height: rect.b - rect.t }} />
			<div style={{ left: rect.r, top: rect.t, width: Math.max(0, vp.w - rect.r), height: rect.b - rect.t }} />
		</div>,
		editor.getContainer()
	)
}

const components: TLComponents = {
	HelperButtons: SlidesPanel,
	Minimap: null,
	InFrontOfTheCanvas: PresentationOverlay,
	// Custom tools aren't added to the default toolbar / shortcuts dialog automatically.
	Toolbar: (props) => {
		const tools = useTools()
		const isSlideSelected = useIsToolSelected(tools['slide'])
		return (
			<DefaultToolbar {...props}>
				<TldrawUiMenuItem {...tools['slide']} isSelected={isSlideSelected} />
				<DefaultToolbarContent />
			</DefaultToolbar>
		)
	},
	KeyboardShortcutsDialog: (props) => {
		const tools = useTools()
		return (
			<DefaultKeyboardShortcutsDialog {...props}>
				<TldrawUiMenuItem {...tools['slide']} />
				<DefaultKeyboardShortcutsDialogContent />
			</DefaultKeyboardShortcutsDialog>
		)
	},
}

// The arrow keys themselves are handled in presentation.ts (capture phase, so they also work with
// the UI hidden). These actions expose next/previous in tldraw's menus and shortcut list.
const overrides: TLUiOverrides = {
	actions(editor, actions) {
		return {
			...actions,
			'next-slide': { id: 'next-slide', label: 'Next slide', onSelect: () => stepSlide(editor, 1) },
			'previous-slide': { id: 'previous-slide', label: 'Previous slide', onSelect: () => stepSlide(editor, -1) },
		}
	},
	tools(editor, tools) {
		tools.slide = {
			id: 'slide',
			icon: 'group',
			label: 'Slide',
			kbd: 's',
			onSelect: () => editor.setCurrentTool('slide'),
		}
		return tools
	},
}

const shapeUtils = [SlideShapeUtil]
const tools = [SlideShapeTool]

export default function App() {
	const presenting = useValue($presenting)
	// Safety net: leave presentation mode if the page is hidden by an unmount/HMR.
	useEffect(() => () => void $presenting.set(false), [])

	return (
		<div className="tldraw__editor">
			<Tldraw
				persistenceKey="tlpres-deck"
				licenseKey={licenseKey}
				assetUrls={assetUrls}
				shapeUtils={shapeUtils}
				tools={tools}
				components={components}
				overrides={overrides}
				hideUi={presenting}
				onMount={(editor: Editor) => {
					if (import.meta.env.DEV) (window as any).editor = editor // handy for debugging; dev only
					const cleanup = installPresentationControls(editor)
					applyCameraMode(editor)
					const goToFirst = () => {
						const first = getSlides(editor)[0]
						if (first) moveToSlide(editor, first, { animate: false })
					}
					if (getSlides(editor).length > 0) {
						goToFirst() // saved in this browser: keep it
					} else {
						// Empty browser: use the deck shipped in public/deck.tldr, else the starter deck.
						loadShippedDeck(editor).then((ok) => {
							if (!ok && getSlides(editor).length === 0) createStarterDeck(editor)
							goToFirst()
						})
					}
					return cleanup
				}}
			/>
		</div>
	)
}
