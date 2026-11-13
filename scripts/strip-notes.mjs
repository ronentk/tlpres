#!/usr/bin/env node
// Blanks the speaker notes of every slide in a .tldr file, in place. Used when publishing: the
// .tldr is downloadable from the site, so notes must not be in it.
//   node scripts/strip-notes.mjs public/deck.tldr
import { readFileSync, writeFileSync } from 'node:fs'
const file = process.argv[2]
if (!file) {
	console.error('Usage: node scripts/strip-notes.mjs <deck.tldr>')
	process.exit(1)
}
const deck = JSON.parse(readFileSync(file, 'utf8'))
let n = 0
for (const r of deck.records) {
	if (r.typeName === 'shape' && r.type === 'slide' && r.props?.notes) {
		r.props.notes = ''
		n++
	}
}
writeFileSync(file, JSON.stringify(deck))
console.log(`Cleared speaker notes on ${n} slide(s) in ${file}`)
