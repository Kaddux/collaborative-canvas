// Deterministic color assignment from clientId
const PALETTE = [
  '#E03131', // red
  '#2F9E44', // green
  '#1971C2', // blue
  '#F08C00', // orange
  '#9C36B5', // purple
  '#0C8599', // teal
  '#E8590C', // burnt orange
  '#6741D9', // indigo
];

export function hashClientIdToColor(clientId: string): string {
  let hash = 0;
  for (let i = 0; i < clientId.length; i++) {
    hash = ((hash << 5) - hash + clientId.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
