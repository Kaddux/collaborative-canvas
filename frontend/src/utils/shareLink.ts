const CANVAS_PARAM = 'canvas';

/** Build an absolute, shareable URL for a canvas: `<origin><path>?canvas=<id>`. */
export function buildShareLink(
  canvasId: string,
  href: string = window.location.href,
): string {
  const url = new URL(href);
  url.search = '';
  url.hash = '';
  url.searchParams.set(CANVAS_PARAM, canvasId);
  return url.toString();
}

/** Read the canvas id from a query string, or null when absent/blank. */
export function getCanvasIdFromUrl(
  search: string = window.location.search,
): string | null {
  const id = new URLSearchParams(search).get(CANVAS_PARAM);
  return id && id.trim() ? id.trim() : null;
}

/** Reflect the joined canvas in the address bar so the page is refreshable/shareable. */
export function setCanvasInUrl(canvasId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set(CANVAS_PARAM, canvasId);
  window.history.replaceState({}, '', url);
}

/** Remove the canvas id from the address bar (e.g. after leaving the canvas). */
export function clearCanvasFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(CANVAS_PARAM);
  window.history.replaceState({}, '', url);
}
