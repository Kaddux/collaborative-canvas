import type { Point, Viewport } from '../types/canvas';

/** Convert screen (pixel) coordinates to canvas (world) coordinates */
export function screenToCanvas(screenX: number, screenY: number, viewport: Viewport): Point {
  return {
    x: (screenX - viewport.offsetX) / viewport.zoom,
    y: (screenY - viewport.offsetY) / viewport.zoom,
  };
}

/** Convert canvas (world) coordinates to screen (pixel) coordinates */
export function canvasToScreen(canvasX: number, canvasY: number, viewport: Viewport): Point {
  return {
    x: canvasX * viewport.zoom + viewport.offsetX,
    y: canvasY * viewport.zoom + viewport.offsetY,
  };
}
