/** Generate a unique object ID */
export function generateObjectId(): string {
  return crypto.randomUUID();
}

/** Get or create a stable client ID for this browser tab */
export function generateClientId(): string {
  const KEY = 'collaborative-canvas-client-id';
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(KEY, id);
  }
  return id;
}
