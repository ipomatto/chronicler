/**
 * build-icons.mjs
 * Converts resources/icon.svg → resources/icon.png (256x256) → resources/icon.ico
 *
 * Dependencies (devDependencies):
 *   @resvg/resvg-js   — SVG rasteriser (no native deps, pure Wasm)
 *   png-to-ico        — PNG → multi-size ICO
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const resourcesDir = path.join(__dirname, '../resources')

// ── 1. SVG → PNG ──────────────────────────────────────────────────────────────
const { Resvg } = await import('@resvg/resvg-js')

const svgData = readFileSync(path.join(resourcesDir, 'icon.svg'))
const resvg = new Resvg(svgData, { fitTo: { mode: 'width', value: 256 } })
const pngData = resvg.render().asPng()
const pngPath = path.join(resourcesDir, 'icon.png')
writeFileSync(pngPath, pngData)
console.log(`✓ icon.png written (${pngData.length} bytes)`)

// ── 2. PNG → ICO (includes 16, 32, 48, 256 sizes) ────────────────────────────
const pngToIco = (await import('png-to-ico')).default
const icoBuffer = await pngToIco([pngPath])
const icoPath = path.join(resourcesDir, 'icon.ico')
writeFileSync(icoPath, icoBuffer)
console.log(`✓ icon.ico written (${icoBuffer.length} bytes)`)
