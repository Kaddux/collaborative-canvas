// ── Object types matching the backend enum ──────────────────────────
export type CanvasObjectType =
  | 'RECTANGLE'
  | 'ELLIPSE'
  | 'DIAMOND'
  | 'LINE'
  | 'ARROW'
  | 'TEXT'
  | 'STICKY_NOTE';

// ── Core canvas object ──────────────────────────────────────────────
export interface CanvasObject {
  objectId: string;
  type: CanvasObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;        // fill
  strokeColor: string;
  strokeWidth: number;
  text: string | null;
}

// ── Tool union ──────────────────────────────────────────────────────
export type Tool =
  | 'SELECT'
  | CanvasObjectType;

// ── Geometry helpers ────────────────────────────────────────────────
export interface Point {
  x: number;
  y: number;
}

export interface Viewport {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

// ── Peer presence ───────────────────────────────────────────────────
export interface PeerState {
  clientId: string;
  color: string;
  cursor: Point | null;
  lastSeen: number;  // Date.now()
}

// ── Outbound messages (client → server) ─────────────────────────────
export interface OutboundOperation {
  type: 'CREATE_OBJECT' | 'MOVE_OBJECT' | 'DELETE_OBJECT' | 'UPDATE_OBJECT';
  objectId: string;
  objectType?: CanvasObjectType;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  text?: string | null;
}

export interface OutboundPresence {
  type: 'PRESENCE';
  cursor: Point;
}

export interface OutboundHistoryAction {
  type: 'UNDO' | 'REDO';
}

export type OutboundMessage =
  | OutboundOperation
  | OutboundPresence
  | OutboundHistoryAction;

// ── Inbound messages (server → client) ──────────────────────────────
export interface InboundOperation {
  type: 'OPERATION';
  clientId: string;
  canvasId: string;
  payload: {
    operationId: string;
    sequence: number;
    type: 'CREATE_OBJECT' | 'MOVE_OBJECT' | 'DELETE_OBJECT' | 'UPDATE_OBJECT';
    objectId: string;
    objectType?: CanvasObjectType;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    color?: string;
    strokeColor?: string;
    strokeWidth?: number;
    text?: string | null;
  };
}

export interface InboundSyncState {
  type: 'SYNC_STATE';
  canvasId: string;
  payload: CanvasObject[];
  sequence: number;
  metadata?: {
    clients?: string[];
  };
}

export interface InboundClientJoined {
  type: 'CLIENT_JOINED';
  clientId: string;
  canvasId: string;
}

export interface InboundClientLeft {
  type: 'CLIENT_LEFT';
  clientId: string;
  canvasId: string;
}

export interface InboundPresence {
  type: 'PRESENCE';
  clientId: string;
  cursor: Point;
  canvasId: string;
}

export interface InboundError {
  type: 'ERROR';
  canvasId: string;
  payload: string;
}

export interface InboundHistoryState {
  type: 'HISTORY_STATE';
  canvasId: string;
  clientId?: string;
  metadata?: {
    canUndo?: boolean;
    canRedo?: boolean;
  };
}

export type InboundMessage =
  | InboundOperation
  | InboundSyncState
  | InboundClientJoined
  | InboundClientLeft
  | InboundPresence
  | InboundHistoryState
  | InboundError;

// ── Canvas metadata (REST responses) ────────────────────────────────
export interface CanvasMetadata {
  canvasId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
