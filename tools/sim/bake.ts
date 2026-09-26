// Runs the site preset to its settled end and writes public/bake/<font>.bin.gz.
// Usage: npx tsx tools/sim/bake.ts [nycd|damion]
import fs from 'node:fs'
import zlib from 'node:zlib'
import nycd from '../../src/lettering/NothingYouCouldDo.strokes.json'
import damion from '../../src/lettering/Damion.strokes.json'
import type { StrokeSet } from '../../src/lettering/types'
import { encodeBake } from '../../src/physics/bake'
import { presetKey, siteKinematics, sitePhysics } from '../../src/physics/preset'
import { PasteSimulation } from '../../src/physics/simulation'

const font = process.argv[2] ?? 'nycd'
const set = (font === 'damion' ? damion : nycd) as StrokeSet
const sim = new PasteSimulation(set, siteKinematics, sitePhysics, -0.9)
const t0 = performance.now()
sim.advanceTo(sim.endTime)
const key = presetKey(siteKinematics, sitePhysics, font)
const raw = encodeBake(sim.field, key)
const gz = zlib.gzipSync(raw, { level: 9 })
fs.writeFileSync(`src/assets/bake/${font}.bin.gz`, gz)
console.log(`${font}: simulated in ${(performance.now() - t0).toFixed(0)} ms, key ${key}, ${raw.length} B raw → ${gz.length} B gzip, volume ${(sim.field.totalVolume() * 1e6).toFixed(2)} ml`)
