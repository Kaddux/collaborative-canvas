import type { CanvasObjectType, Point } from '../types/canvas';

const MIN_FONT_SIZE = 6;
const MAX_FONT_SIZE = 200;

/** Default glyph size for text-bearing object types. */
export function defaultFontSize(type: CanvasObjectType): number {
  return type === 'STICKY_NOTE' ? 14 : 16;
}

/** Effective font size, falling back for legacy objects that have no stored size. */
export function effectiveFontSize(
  fontSize: number | null | undefined,
  type: CanvasObjectType,
): number {
  return fontSize && fontSize > 0 ? fontSize : defaultFontSize(type);
}

/** Scale a base font size by a resize ratio, clamped to sane bounds. */
export function scaleFontSize(
  base: number,
  ratio: number,
  min = MIN_FONT_SIZE,
  max = MAX_FONT_SIZE,
): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return Math.max(min, base);
  return Math.max(min, Math.min(max, base * ratio));
}

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
