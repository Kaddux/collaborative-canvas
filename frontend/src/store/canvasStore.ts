import { create } from 'zustand';
import type {
  CanvasObject,
  CanvasObjectType,
  Tool,
  Viewport,
  PeerState,
  Point,
} from '../types/canvas';
import { hashClientIdToColor } from '../utils/colors';

interface CanvasState {
  // ── Connection ──
  canvasId: string | null;
  canvasName: string | null;
  clientId: string;
  connected: boolean;

  // ── Canvas objects ──
  objects: Map<string, CanvasObject>;
  sequence: number;
  pendingResize: { objectId: string; snapshot: CanvasObject } | null;

  // ── Undo/redo availability (server-authoritative, per client) ──
  canUndo: boolean;
  canRedo: boolean;

  // ── Local interaction ──
  activeTool: Tool;
  selectedObjectId: string | null;

  // ── Viewport / camera ──
  viewport: Viewport;

  // ── Peers ──
  peers: Map<string, PeerState>;

  // ── Actions ──
  setConnection: (canvasId: string, canvasName: string, clientId: string) => void;
  setConnected: (connected: boolean) => void;
  setHistoryState: (canUndo: boolean, canRedo: boolean) => void;
  setActiveTool: (tool: Tool) => void;
  setSelectedObjectId: (id: string | null) => void;
  setViewport: (viewport: Viewport) => void;
  panViewport: (dx: number, dy: number) => void;
  zoomViewport: (factor: number, anchorX: number, anchorY: number) => void;

  // Sync from server
  applySync: (objects: CanvasObject[], sequence: number, clients?: string[]) => void;

  // Optimistic local operations
  optimisticCreate: (object: CanvasObject) => void;
  optimisticMove: (objectId: string, x: number, y: number) => void;
  optimisticDelete: (objectId: string) => void;
  optimisticUpdate: (
    objectId: string,
    fields: Partial<Pick<CanvasObject, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'color' | 'strokeColor' | 'strokeWidth' | 'text'>>
  ) => void;
  beginResize: (objectId: string) => void;
  clearPendingResize: (objectId: string) => void;
  rollbackResize: (objectId: string) => void;

  // Remote operations
  applyRemoteCreate: (op: {
    objectId: string;
    objectType?: CanvasObjectType;
    x: number;
    y: number;
    width?: number;
    height?: number;
    rotation?: number;
    color?: string;
    strokeColor?: string;
    strokeWidth?: number;
    text?: string | null;
  }, sequence: number) => void;
  applyRemoteMove: (objectId: string, x: number, y: number, sequence: number) => void;
  applyRemoteDelete: (objectId: string, sequence: number) => void;
  applyRemoteUpdate: (op: {
    objectId: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    color?: string;
    strokeColor?: string;
    strokeWidth?: number;
    text?: string | null;
  }, sequence: number) => void;

  // Peers
  addPeer: (clientId: string) => void;
  removePeer: (clientId: string) => void;
  updatePeerCursor: (clientId: string, cursor: Point) => void;

  // Error handling
  handleError: (message: string) => void;

  // Remote editing highlight
  remoteEditHighlights: Map<string, { clientId: string; expiry: number }>;
  addRemoteEditHighlight: (objectId: string, clientId: string) => void;

  // Reset
  reset: () => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  canvasId: null,
  canvasName: null,
  clientId: '',
  connected: false,

  objects: new Map(),
  sequence: 0,
  pendingResize: null,

  canUndo: false,
  canRedo: false,

  activeTool: 'SELECT',
  selectedObjectId: null,

  viewport: { offsetX: 0, offsetY: 0, zoom: 1 },

  peers: new Map(),

  remoteEditHighlights: new Map(),

  // ── Connection ──────────────────────────────────────────────────────
  setConnection: (canvasId, canvasName, clientId) =>
    set({ canvasId, canvasName, clientId }),

  setConnected: (connected) => set({ connected }),

  setHistoryState: (canUndo, canRedo) => set({ canUndo, canRedo }),

  setActiveTool: (tool) => set({ activeTool: tool }),

  setSelectedObjectId: (id) => set({ selectedObjectId: id }),

  setViewport: (viewport) => set({ viewport }),

  panViewport: (dx, dy) =>
    set((state) => ({
      viewport: {
        ...state.viewport,
        offsetX: state.viewport.offsetX + dx,
        offsetY: state.viewport.offsetY + dy,
      },
    })),

  zoomViewport: (factor, anchorX, anchorY) =>
    set((state) => {
      const oldZoom = state.viewport.zoom;
      const newZoom = Math.max(0.1, Math.min(5, oldZoom * factor));
      return {
        viewport: {
          offsetX: anchorX - (anchorX - state.viewport.offsetX) * (newZoom / oldZoom),
          offsetY: anchorY - (anchorY - state.viewport.offsetY) * (newZoom / oldZoom),
          zoom: newZoom,
        },
      };
    }),

  // ── Full sync (on connect/reconnect) ────────────────────────────────
  applySync: (objects, sequence, clients) =>
    set((state) => {
      const newObjects = new Map<string, CanvasObject>();
      for (const obj of objects) {
        newObjects.set(obj.objectId, obj);
      }
      const peers = new Map(state.peers);
      if (clients) {
        for (const cid of clients) {
          if (cid !== state.clientId && !peers.has(cid)) {
            peers.set(cid, {
              clientId: cid,
              color: hashClientIdToColor(cid),
              cursor: null,
              lastSeen: Date.now(),
            });
          }
        }
      }
      return { objects: newObjects, sequence, peers };
    }),

  // ── Optimistic local operations ─────────────────────────────────────
  optimisticCreate: (object) =>
    set((state) => {
      const objects = new Map(state.objects);
      objects.set(object.objectId, object);
      return { objects, selectedObjectId: object.objectId, activeTool: 'SELECT' };
    }),

  optimisticMove: (objectId, x, y) =>
    set((state) => {
      const objects = new Map(state.objects);
      const obj = objects.get(objectId);
      if (obj) {
        objects.set(objectId, { ...obj, x, y });
      }
      return { objects };
    }),

  optimisticDelete: (objectId) =>
    set((state) => {
      const objects = new Map(state.objects);
      objects.delete(objectId);
      return {
        objects,
        selectedObjectId: state.selectedObjectId === objectId ? null : state.selectedObjectId,
      };
    }),

  optimisticUpdate: (objectId, fields) =>
    set((state) => {
      const objects = new Map(state.objects);
      const obj = objects.get(objectId);
      if (obj) {
        objects.set(objectId, { ...obj, ...fields });
      }
      return { objects };
    }),

  beginResize: (objectId) =>
    set((state) => {
      const object = state.objects.get(objectId);
      return object ? { pendingResize: { objectId, snapshot: { ...object } } } : {};
    }),

  clearPendingResize: (objectId) =>
    set((state) => state.pendingResize?.objectId === objectId ? { pendingResize: null } : {}),

  rollbackResize: (objectId) =>
    set((state) => {
      if (state.pendingResize?.objectId !== objectId) return {};
      const objects = new Map(state.objects);
      if (objects.has(objectId)) objects.set(objectId, state.pendingResize.snapshot);
      return { objects, pendingResize: null };
    }),

  // ── Remote operations ───────────────────────────────────────────────
  applyRemoteCreate: (op, sequence) =>
    set((state) => {
      const objects = new Map(state.objects);
      const newObj: CanvasObject = {
        objectId: op.objectId,
        type: op.objectType ?? 'RECTANGLE',
        x: op.x,
        y: op.y,
        width: op.width ?? 200,
        height: op.height ?? 100,
        rotation: op.rotation ?? 0,
        color: op.color ?? '#ffffff',
        strokeColor: op.strokeColor ?? '#1E1E1E',
        strokeWidth: op.strokeWidth ?? 2,
        text: op.text ?? null,
      };
      objects.set(op.objectId, newObj);
      return { objects, sequence };
    }),

  applyRemoteMove: (objectId, x, y, sequence) =>
    set((state) => {
      const objects = new Map(state.objects);
      const obj = objects.get(objectId);
      if (obj) {
        objects.set(objectId, { ...obj, x, y });
      }
      return { objects, sequence };
    }),

  applyRemoteDelete: (objectId, sequence) =>
    set((state) => {
      const objects = new Map(state.objects);
      objects.delete(objectId);
      return {
        objects,
        sequence,
        selectedObjectId: state.selectedObjectId === objectId ? null : state.selectedObjectId,
      };
    }),

  applyRemoteUpdate: (op, sequence) =>
    set((state) => {
      const objects = new Map(state.objects);
      const obj = objects.get(op.objectId);
      if (obj) {
        const updated = { ...obj };
        if (op.x !== undefined) updated.x = op.x;
        if (op.y !== undefined) updated.y = op.y;
        if (op.width !== undefined) updated.width = op.width;
        if (op.height !== undefined) updated.height = op.height;
        if (op.rotation !== undefined) updated.rotation = op.rotation;
        if (op.color !== undefined) updated.color = op.color;
        if (op.strokeColor !== undefined) updated.strokeColor = op.strokeColor;
        if (op.strokeWidth !== undefined) updated.strokeWidth = op.strokeWidth;
        if (op.text !== undefined) updated.text = op.text;
        objects.set(op.objectId, updated);
      }
      return { objects, sequence };
    }),

  // ── Peers ───────────────────────────────────────────────────────────
  addPeer: (clientId) =>
    set((state) => {
      if (clientId === state.clientId) return {};
      const peers = new Map(state.peers);
      if (!peers.has(clientId)) {
        peers.set(clientId, {
          clientId,
          color: hashClientIdToColor(clientId),
          cursor: null,
          lastSeen: Date.now(),
        });
      }
      return { peers };
    }),

  removePeer: (clientId) =>
    set((state) => {
      const peers = new Map(state.peers);
      peers.delete(clientId);
      return { peers };
    }),

  updatePeerCursor: (clientId, cursor) =>
    set((state) => {
      if (clientId === state.clientId) return {};
      const peers = new Map(state.peers);
      const peer = peers.get(clientId);
      if (peer) {
        peers.set(clientId, { ...peer, cursor, lastSeen: Date.now() });
      } else {
        peers.set(clientId, {
          clientId,
          color: hashClientIdToColor(clientId),
          cursor,
          lastSeen: Date.now(),
        });
      }
      return { peers };
    }),

  // ── Error handling ──────────────────────────────────────────────────
  handleError: (message) => {
    console.error('[Canvas] Server error:', message);
    // For now, just log. Could revert pending ops here.
  },

  // ── Remote edit highlight ───────────────────────────────────────────
  addRemoteEditHighlight: (objectId, clientId) =>
    set((state) => {
      const remoteEditHighlights = new Map(state.remoteEditHighlights);
      remoteEditHighlights.set(objectId, {
        clientId,
        expiry: Date.now() + 2000,
      });
      return { remoteEditHighlights };
    }),

  // ── Reset ───────────────────────────────────────────────────────────
  reset: () =>
    set({
      canvasId: null,
      canvasName: null,
      connected: false,
      objects: new Map(),
      sequence: 0,
      activeTool: 'SELECT',
      selectedObjectId: null,
      viewport: { offsetX: 0, offsetY: 0, zoom: 1 },
      peers: new Map(),
      remoteEditHighlights: new Map(),
      pendingResize: null,
      canUndo: false,
      canRedo: false,
    }),
}));
