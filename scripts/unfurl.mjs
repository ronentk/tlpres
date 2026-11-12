#!/usr/bin/env node
// Fills in link-card (bookmark) previews in a .tldr file: title, description, og:image and favicon.
// The browser can't read other sites' metadata, so run this before the talk instead:
//
//   node scripts/unfurl.mjs decks/my-talk.tldr            # fill in cards that have no image yet
//   node scripts/unfurl.mjs decks/my-talk.tldr --force    # redo all cards
//   node scripts/unfurl.mjs a.tldr b.tldr --remote        # keep image URLs instead of embedding
//
// Images are embedded in the file as data URLs by default, so the deck works offline and the
// preview can't disappear later. A backup is written to <file>.bak before the file is changed.
// Needs Node 18+ (built-in fetch). No dependencies.
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'

const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('--')))
const files = args.filter((a) => !a.startsWith('--'))
if (!files.length) {
	console.error('Usage: node scripts/unfurl.mjs <deck.tldr> [more.tldr] [--force] [--remote]')
	process.exit(1)
}
const force = flags.has('--force')
const embed = !flags.has('--remote')
const MAX_IMAGE_BYTES = 3_000_000
const UA = 'Mozilla/5.0 (compatible; tlpres-unfurl)'

const decode = (s) =>
	s
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;|&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
		.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))

function attrs(tag) {
	const out = {}
	for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1].toLowerCase()] = decode(m[2] ?? m[3])
	return out
}

function parseMeta(html, base) {
	const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => attrs(m[0]))
	const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => attrs(m[0]))
	const meta = (...names) => {
		for (const n of names) {
			const hit = metas.find((a) => (a.property ?? a.name)?.toLowerCase() === n && a.content)
			if (hit) return hit.content
		}
		return ''
	}
	const abs = (u) => {
		try {
			return u ? new URL(u, base).href : ''
		} catch {
			return ''
		}
	}
	const icon =
		links.find((a) => /apple-touch-icon/i.test(a.rel ?? '') && a.href) ??
		links.find((a) => /(^|\s)icon(\s|$)/i.test(a.rel ?? '') && a.href)
	return {
		title: meta('og:title', 'twitter:title') || decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? ''),
		description: meta('og:description', 'twitter:description', 'description'),
		image: abs(meta('og:image', 'og:image:url', 'twitter:image')),
		favicon: abs(icon?.href ?? '/favicon.ico'),
	}
}

async function get(url) {
	const res = await fetch(url, { headers: { 'user-agent': UA, accept: '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(20_000) })
	if (!res.ok) throw new Error(`HTTP ${res.status}`)
	return res
}

async function toDataUrl(url) {
	const res = await get(url)
	const type = (res.headers.get('content-type') ?? '').split(';')[0].trim()
	if (!type.startsWith('image/')) throw new Error(`not an image (${type || 'unknown type'})`)
	const buf = Buffer.from(await res.arrayBuffer())
	if (buf.length > MAX_IMAGE_BYTES) throw new Error(`image too large (${Math.round(buf.length / 1024)} KB)`)
	return `data:${type};base64,${buf.toString('base64')}`
}

for (const file of files) {
	const deck = JSON.parse(readFileSync(file, 'utf8'))
	const cards = deck.records.filter((r) => r.typeName === 'asset' && r.type === 'bookmark')
	console.log(`\n${file}: ${cards.length} link card(s)`)
	let changed = 0
	for (const card of cards) {
		const p = card.props
		if (!force && p.image) {
			console.log(`  skip (already has an image)  ${p.src}`)
			continue
		}
		try {
			const meta = parseMeta(await (await get(p.src)).text(), p.src)
			let image = meta.image
			let favicon = meta.favicon
			if (embed) {
				if (image) image = await toDataUrl(image).catch((e) => (console.warn(`    image: ${e.message}`), ''))
				if (favicon) favicon = await toDataUrl(favicon).catch(() => '')
			}
			// Keep a title the user has set by hand; the default title is just the URL.
			if (meta.title && (force || !p.title || p.title === p.src)) p.title = meta.title
			if (meta.description) p.description = meta.description
			p.image = image
			p.favicon = favicon
			// Cards with a preview image are taller than the short (title-only) cards.
			const height = image ? 320 : p.title ? 101 : 46
			for (const sh of deck.records) {
				if (sh.typeName === 'shape' && sh.type === 'bookmark' && sh.props.assetId === card.id) sh.props.h = height
			}
			changed++
			console.log(`  ok    ${p.src}\n        "${p.title}"  image: ${image ? 'yes' : 'NONE (site has no og:image)'}`)
		} catch (e) {
			console.warn(`  FAIL  ${p.src}: ${e.message}`)
		}
	}
	if (changed) {
		copyFileSync(file, file + '.bak')
		writeFileSync(file, JSON.stringify(deck))
		console.log(`  wrote ${file} (backup: ${file}.bak)`)
	}
}
