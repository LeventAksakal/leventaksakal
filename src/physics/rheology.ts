/**
 * Rheology of tube paint: a yield-stress (viscoplastic) fluid, Herschel–Bulkley model.
 *   τ = τ_y + K γ̇ⁿ   when |τ| > τ_y   (flows, shear-thinning for n < 1)
 *   γ̇ = 0            when |τ| ≤ τ_y   (rigid plug: why a bead holds its round shape)
 */
import type { PhysicsParams } from './params'

export interface DerivedNumbers {
  /** m — tallest heap the yield stress holds: τ_y / (ρ g) */
  holdHeight: number
  /** m — capillary length √(γ / (ρ g)) */
  capillaryLength: number
  /** — Bond number ρ g R² / γ for the bead half-width R */
  bond: number
  /** Pa·s — effective plastic viscosity K γ̇_ref^(n−1) */
  plasticViscosity: number
  /** m — extrudate radius */
  extrudateRadius: number
}

export function derive(p: PhysicsParams, beadHalfWidth: number): DerivedNumbers {
  const rg = p.density * p.gravity
  return {
    holdHeight: p.yieldStress / rg,
    capillaryLength: Math.sqrt(p.surfaceTension / rg),
    bond: (rg * beadHalfWidth * beadHalfWidth) / p.surfaceTension,
    plasticViscosity: plasticViscosity(p),
    extrudateRadius: p.nozzleRadius * p.dieSwell,
  }
}

/** Effective plastic viscosity for the thin-layer model: HB consistency evaluated at γ̇_ref. */
export function plasticViscosity(p: PhysicsParams): number {
  return p.consistency * Math.pow(p.referenceShearRate, p.flowIndex - 1)
}

/**
 * Herschel–Bulkley effective viscosity with Papanastasiou regularisation:
 * μ_eff(γ̇) = K γ̇^(n−1) + τ_y (1 − e^(−m γ̇)) / γ̇
 */
export function effectiveViscosity(p: PhysicsParams, shearRate: number): number {
  const g = Math.max(shearRate, 1e-6)
  return p.consistency * Math.pow(g, p.flowIndex - 1) + (p.yieldStress * (1 - Math.exp(-p.papanastasiouM * g))) / g
}

/**
 * Shallow-layer Bingham flux coefficient (Liu & Mei 1989; Balmforth & Craster 1999).
 *   q = −c ∇h,   c = ρ g Y² (3h − Y) / (6 μ),   Y = max(0, h − τ_y / (ρ g |∇h|))
 * Y is the thickness of the yielded (sheared) layer; above it the paste rides as a rigid plug.
 * Returns c in m²/s, or 0 where the layer is locked by its yield stress.
 */
export function binghamFluxCoefficient(h: number, slope: number, rg: number, yieldStress: number, mu: number): number {
  if (h <= 0 || slope <= 0) return 0
  const Y = h - yieldStress / (rg * slope)
  if (Y <= 0) return 0
  return (rg * Y * Y * (3 * h - Y)) / (6 * mu)
}
