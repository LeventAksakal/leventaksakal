/**
 * The tuned parameter set the site ships with. The lab starts from it, the bake tool
 * simulates it, and the live intro runs it, so the baked final state matches the live run.
 */
import { defaultKinematics, type KinematicsParams } from './kinematics'
import { defaultPhysics, type PhysicsParams } from './params'

export const siteKinematics: KinematicsParams = {
  ...defaultKinematics,
  nozzleHeight: 4,
  drawDuration: 12.5,
  liftMin: 0.22,
  liftMax: 0.45,
  liftHeight: 22,
  beadWidth: 4.4,
  areaRatioMax: 1.5,
}

export const sitePhysics: PhysicsParams = { ...defaultPhysics }

/** Stable fingerprint of a parameter set (so a bake is only used for the run it came from). */
export function presetKey(kin: KinematicsParams, phys: PhysicsParams, font: string): string {
  const s = JSON.stringify({ kin, phys, font })
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(16)
}
