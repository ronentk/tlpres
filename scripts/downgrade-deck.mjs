#!/usr/bin/env node
// Converts a .tldr saved by tldraw 5.x into one that tldraw 3.15 can open. tldraw can only migrate
// files *up*, so this applies the few format differences by hand:
//   node scripts/downgrade-deck.mjs in.tldr out.tldr
// Lossy where 3.15 has no equivalent: arrow label formatting (kept as plain text), geo flips.
import { readFileSync, writeFileSync } from 'node:fs'
import { createTLSchema } from '@tldraw/tlschema'

const [input, output] = process.argv.slice(2)
if (!input || !output) {
	console.error('Usage: node scripts/downgrade-deck.mjs <in.tldr> <out.tldr>')
	process.exit(1)
}
const deck = JSON.parse(readFileSync(input, 'utf8'))

const stats = {}
const bump = (k) => (stats[k] = (stats[k] ?? 0) + 1)
const plain = (rt) => {
	const out = []
	const walk = (n) => {
		if (n.type === 'text') out.push(n.text ?? '')
		else if (n.type === 'hardBreak') out.push('\n')
		;(n.content ?? []).forEach(walk)
		if (n.type === 'paragraph') out.push('\n')
	}
	if (rt) walk(rt)
	return out.join('').replace(/\n+$/, '')
}
// 3.15 rich text docs have no `attrs` on the root, and no underline mark.
const MARKS = new Set(['bold', 'italic', 'code', 'strike', 'highlight', 'link'])
const stripAttrs = (n) => {
	if (Array.isArray(n)) return n.forEach(stripAttrs)
	if (n && typeof n === 'object') {
		delete n.attrs
		if (Array.isArray(n.marks)) {
			const before = n.marks.length
			n.marks = n.marks.filter((m) => MARKS.has(m.type))
			if (n.marks.length !== before) bump('underline/other marks dropped')
			if (!n.marks.length) delete n.marks
		}
		Object.values(n).forEach(stripAttrs)
	}
}

const keep = new Set(['asset', 'shape', 'binding', 'page', 'document'])
deck.records = deck.records.filter((r) => keep.has(r.typeName))
for (const r of deck.records) {
	const p = r.props
	if (r.typeName === 'shape') {
		if (p?.richText) {
			if (r.type === 'arrow') {
				p.text = plain(p.richText)
				delete p.richText
				bump('arrow labels flattened')
			} else {
				stripAttrs(p.richText)
			}
		}
		if (r.type === 'arrow' && p && p.text === undefined) p.text = ''
		if (r.type === 'geo') {
			delete p.flipX
			delete p.flipY
		}
	}
	if (r.typeName === 'asset' && r.type === 'image') delete p.pixelRatio
}

const seq = createTLSchema().serialize().sequences
Object.assign(seq, { 'com.tldraw.shape.slide': 0, 'com.tldraw.shape.collapsible': 1, 'com.tldraw.shape.imagenote': 1 })
deck.schema = { schemaVersion: 2, sequences: seq }
writeFileSync(output, JSON.stringify(deck))
console.log(`Wrote ${output}`, stats)
