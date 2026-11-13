#!/usr/bin/env node
// Builds the read-only viewer once per deck into site/<name>/, plus a small index page, so the
// published URLs look like https://<host>/<repo>/<name>/ .
//   node scripts/build-site.mjs decks/sor-nov-26.tldr [decks/other.tldr ...]
// <name> is the file name lower-cased with anything but letters/digits turned into "-".
// Each deck is converted to the tldraw 3.x file format and has its speaker notes removed.
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { basename } from 'node:path'

const decks = process.argv.slice(2)
if (!decks.length) {
	console.error('Usage: node scripts/build-site.mjs <deck.tldr> [more.tldr ...]')
	process.exit(1)
}
const slug = (file) =>
	basename(file).replace(/\.tldr$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const run = (cmd, args, env = {}) => execFileSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } })

rmSync('site', { recursive: true, force: true })
mkdirSync('site', { recursive: true })
const built = []
for (const file of decks) {
	const name = slug(file)
	if (built.some((b) => b.name === name)) throw new Error(`Two decks would both be published as "${name}"`)
	console.log(`\n== ${file} -> /${name}/`)
	run('node', ['scripts/downgrade-deck.mjs', file, 'public/deck.tldr'])
	run('node', ['scripts/strip-notes.mjs', 'public/deck.tldr'])
	try {
		run('npx', ['vite', 'build', '--outDir', `site/${name}`, '--emptyOutDir'], { VITE_VIEWER: '1' })
	} finally {
		if (existsSync('public/deck.tldr')) rmSync('public/deck.tldr')
	}
	built.push({ name, file })
}
const items = built.map((b) => `<li><a href="${b.name}/">${b.name}</a></li>`).join('\n')
writeFileSync(
	'site/index.html',
	`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Decks</title>
<body style="font:18px system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 16px"><h1>Decks</h1><ul>\n${items}\n</ul></body>`
)
console.log(`\nBuilt ${built.length} deck(s): ${built.map((b) => '/' + b.name + '/').join(', ')}`)
