/**
 * Physical constants for the paste model. SI units throughout (metres, seconds, kg, Pa).
 * Every value is art-directable and exposed in the lab GUI; comments give units.
 */

export interface PhysicsParams {
  /** m/s² — gravitational acceleration */
  gravity: number
  /** kg/m³ — paste density (oil/acrylic paint ≈ 1500–1800) */
  density: number
  /** Pa — Herschel–Bulkley yield stress τ_y. Lower = runnier, honey-like; higher = stiff toothpaste */
  yieldStress: number
  /** Pa·sⁿ — Herschel–Bulkley consistency K */
  consistency: number
  /** — Herschel–Bulkley flow index n (< 1 shear-thinning) */
  flowIndex: number
  /** 1/s — characteristic shear rate used to turn K, n into an effective plastic viscosity */
  referenceShearRate: number
  /** s — Papanastasiou regularisation exponent m */
  papanastasiouM: number
  /** N/m — surface tension γ */
  surfaceTension: number

  /** m — nozzle bore radius */
  nozzleRadius: number
  /** — die swell: extrudate radius / nozzle radius (1.1–1.3) */
  dieSwell: number
  /** — height / width of a freshly laid bead before it settles */
  beadAspect: number
  /** — extrusion during the first-touch dwell, as a fraction of the median writing flow Q₀ */
  dwellFlowRatio: number
  /** — touchdown lag behind the nozzle, in nozzle heights, in the dragged-catenary regime */
  contactLag: number
  /** — V* below which the thread buckles and coils */
  coilOnset: number
  /** — coil radius in extrudate radii */
  coilRadius: number
  /** — 0 disables coiling, 1 = full */
  coilAmount: number

  /** — stretch ratio L/L₀ at which a lifting thread must have snapped */
  snapStretch: number
  /** — neck radius (× extrudate radius) at which the thread snaps */
  snapRadius: number
  /** — fraction of the airborne thread volume that falls back as a tail peak */
  tailPeakFraction: number
  /** — tail peak radius in bead half-widths */
  tailPeakRadius: number

  /** s — how long freshly laid paste keeps flowing (yield stops it sooner if it can) */
  settleTime: number
  /** m²/s — surface-tension edge rounding, applied as a short-lived diffusion */
  edgeRounding: number
  /** s — how long edge rounding acts after deposition */
  edgeRoundingTime: number

  /** m³ — paste in a full tube */
  tubeVolume: number

  /** m — height-field cell size */
  cellSize: number
  /** m — margin around the name inside the height field */
  fieldMargin: number
  /** Hz — fixed simulation rate (decoupled from rendering) */
  stepRate: number
  /** — CFL substeps allowed per relaxation call; the rest of the interval is dropped */
  maxRelaxSubsteps: number
  /** — run the thin-layer relaxation every k steps */
  relaxEvery: number
  /** — seed for the deterministic RNG */
  seed: number
}

export const defaultPhysics: PhysicsParams = {
  gravity: 9.81,
  density: 1600,
  yieldStress: 90,
  consistency: 25,
  flowIndex: 0.5,
  referenceShearRate: 10,
  papanastasiouM: 300,
  surfaceTension: 0.03,

  nozzleRadius: 2.0e-3,
  dieSwell: 1.18,
  beadAspect: 0.62,
  dwellFlowRatio: 0.16,
  contactLag: 0.8,
  coilOnset: 0.55,
  coilRadius: 1.4,
  coilAmount: 0.35,

  snapStretch: 3.2,
  snapRadius: 0.22,
  tailPeakFraction: 0.3,
  tailPeakRadius: 0.4,

  settleTime: 0.9,
  edgeRounding: 2.5e-7,
  edgeRoundingTime: 0.35,

  tubeVolume: 21e-6,

  cellSize: 0.25e-3,
  fieldMargin: 12e-3,
  stepRate: 240,
  relaxEvery: 2,
  maxRelaxSubsteps: 3,
  seed: 20260926,
}
