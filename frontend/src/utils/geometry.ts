import type { Point } from '../types/canvas';

/** Normalize an angle in degrees to the [0, 360) range. */
export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Clockwise angle in degrees from `from` to `to`, in screen/canvas coordinates
 * (y grows downward), matching the SVG `rotate(deg cx cy)` convention.
 */
export function angleBetween(from: Point, to: Point): number {
  return normalizeDeg((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI);
}
