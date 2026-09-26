/** Centerline lettering produced by tools/trace.py. Units are millimetres on the paper,
 *  x to the right, y "down the page" (away from the viewer once the paper is tilted). */
export interface StrokeSet {
  font: string
  units: 'mm'
  size: [number, number]
  /** Stroke width of the source font at this scale; a hint for the bead width. */
  fontStrokeWidthMm: number
  strokes: StrokeDef[]
}

export interface StrokeDef {
  id: string
  order: number
  /** Written after its word (t / A crossbars). Only affects labelling; order is already final. */
  delayed: boolean
  points: [number, number][]
}
