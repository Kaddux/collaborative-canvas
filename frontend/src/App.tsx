import { useState, useEffect, useCallback, useRef } from 'react';
import { useCanvasStore } from './store/canvasStore';
import { CanvasWebSocketClient } from './ws/websocketClient';
import { generateClientId } from './utils/idgen';
import { clearCanvasFromUrl, getCanvasIdFromUrl, setCanvasInUrl } from './utils/shareLink';
import type {
  CanvasMetadata,
  CanvasObject,
  InboundMessage,
  Point,
} from './types/canvas';
import CanvasEntryScreen from './components/CanvasEntryScreen';
import CanvasSurface from './components/CanvasSurface';
import Toolbar from './components/Toolbar';
import StylePanel from './components/StylePanel';

type AppState = 'entry' | 'canvas';

export default function App() {
  const [appState, setAppState] = useState<AppState>('entry');
  const [linkCanvasId] = useState(() => getCanvasIdFromUrl());
  const [resolvingLink, setResolvingLink] = useState(linkCanvasId !== null);
  const [pendingJoinId, setPendingJoinId] = useState<string | null>(linkCanvasId);
  const [linkError, setLinkError] = useState<string | null>(null);
  const wsRef = useRef<CanvasWebSocketClient | null>(null);

  const store = useCanvasStore;
  const clientId = useRef(generateClientId());

  // ── Join canvas ──
  const handleJoinCanvas = useCallback((meta: CanvasMetadata) => {
    const s = store.getState();
    s.setConnection(meta.canvasId, meta.name, clientId.current);
    setCanvasInUrl(meta.canvasId);
    setLinkError(null);
    setPendingJoinId(null);
    setAppState('canvas');
  }, [store]);

  // ── Auto-join from a share link (?canvas=<id>) ──
  useEffect(() => {
    if (!linkCanvasId) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/canvases/${encodeURIComponent(linkCanvasId)}`);
        if (res.status === 404) {
          clearCanvasFromUrl();
          if (!cancelled) setLinkError('Canvas not found. Check the link and try again.');
          return;
        }
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const meta: CanvasMetadata = await res.json();
        if (!cancelled) handleJoinCanvas(meta);
      } catch (err) {
        clearCanvasFromUrl();
        if (!cancelled) {
          setLinkError(err instanceof Error ? err.message : 'Failed to open shared canvas');
        }
      } finally {
        if (!cancelled) setResolvingLink(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [linkCanvasId, handleJoinCanvas]);

  // ── WebSocket lifecycle ──
  useEffect(() => {
    if (appState !== 'canvas') return;

    const state = store.getState();
    if (!state.canvasId) return;

    const ws = new CanvasWebSocketClient(
      state.canvasId,
      state.clientId,
      {
        onMessage: (msg: InboundMessage) => {
          const s = store.getState();
          switch (msg.type) {
            case 'SYNC_STATE':
              s.applySync(
                msg.payload,
                msg.sequence,
                msg.metadata?.clients,
              );
              break;

            case 'OPERATION': {
              const op = msg.payload;
              s.addRemoteEditHighlight(op.objectId, msg.clientId);
              switch (op.type) {
                case 'CREATE_OBJECT':
                  s.applyRemoteCreate(
                    {
                      objectId: op.objectId,
                      objectType: op.objectType,
                      x: op.x ?? 0,
                      y: op.y ?? 0,
                      width: op.width,
                      height: op.height,
                      rotation: op.rotation,
                      color: op.color,
                      strokeColor: op.strokeColor,
                      strokeWidth: op.strokeWidth,
                      text: op.text,
                      textColor: op.textColor,
                    },
                    op.sequence,
                  );
                  break;
                case 'MOVE_OBJECT':
                  s.applyRemoteMove(op.objectId, op.x ?? 0, op.y ?? 0, op.sequence);
                  break;
                case 'DELETE_OBJECT':
                  s.applyRemoteDelete(op.objectId, op.sequence);
                  break;
                case 'UPDATE_OBJECT':
                  s.applyRemoteUpdate(
                    {
                      objectId: op.objectId,
                      x: op.x,
                      y: op.y,
                      width: op.width,
                      height: op.height,
                      rotation: op.rotation,
                      color: op.color,
                      strokeColor: op.strokeColor,
                      strokeWidth: op.strokeWidth,
                      text: op.text,
                      textColor: op.textColor,
                    },
                    op.sequence,
                  );
                  break;
              }
              if (op.type === 'UPDATE_OBJECT' && msg.clientId === store.getState().clientId) {
                s.clearPendingResize(op.objectId);
              }
              break;
            }

            case 'CLIENT_JOINED':
              s.addPeer(msg.clientId);
              break;

            case 'CLIENT_LEFT':
              s.removePeer(msg.clientId);
              break;

            case 'PRESENCE':
              s.updatePeerCursor(msg.clientId, msg.cursor);
              break;

            case 'HISTORY_STATE':
              s.setHistoryState(
                msg.metadata?.canUndo ?? false,
                msg.metadata?.canRedo ?? false,
              );
              break;

            case 'ERROR':
              if (s.pendingResize) s.rollbackResize(s.pendingResize.objectId);
              s.handleError(typeof msg.payload === 'string' ? msg.payload : 'Unknown error');
              break;
          }
        },
        onCanvasNotFound: () => {
          alert('Canvas not found. Returning to home.');
          clearCanvasFromUrl();
          store.getState().reset();
          setAppState('entry');
        },
        onConnected: () => {
          store.getState().setConnected(true);
        },
        onDisconnected: () => {
          store.getState().setConnected(false);
        },
      },
    );

    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.disconnect();
      wsRef.current = null;
    };
  }, [appState, store]);

  // ── Callbacks for CanvasSurface ──
  const handleCreateObject = useCallback((obj: CanvasObject) => {
    const s = store.getState();
    s.optimisticCreate(obj);
    wsRef.current?.send({
      type: 'CREATE_OBJECT',
      objectId: obj.objectId,
      objectType: obj.type,
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      rotation: obj.rotation,
      color: obj.color,
      strokeColor: obj.strokeColor,
      strokeWidth: obj.strokeWidth,
      text: obj.text,
      textColor: obj.textColor,
    });
  }, [store]);

  const handleMoveObject = useCallback((objectId: string, x: number, y: number) => {
    wsRef.current?.send({
      type: 'MOVE_OBJECT',
      objectId,
      x,
      y,
    });
  }, []);

  const handleResizeObject = useCallback((objectId: string, x: number, y: number, width: number, height: number) => {
    const obj = store.getState().objects.get(objectId);
    if (!obj) return;
    // UPDATE_OBJECT overwrites every field server-side, so send a full snapshot; a
    // partial payload would zero out rotation/colors/text.
    wsRef.current?.send({
      type: 'UPDATE_OBJECT',
      objectId,
      objectType: obj.type,
      x,
      y,
      width,
      height,
      rotation: obj.rotation,
      color: obj.color,
      strokeColor: obj.strokeColor,
      strokeWidth: obj.strokeWidth,
      text: obj.text,
      textColor: obj.textColor,
    });
  }, [store]);

  const handleRotateObject = useCallback((objectId: string, rotation: number) => {
    const obj = store.getState().objects.get(objectId);
    if (!obj) return;
    // Rotation is applied optimistically during the drag; send a full snapshot so the
    // server (which overwrites every field) preserves the rest of the object.
    wsRef.current?.send({
      type: 'UPDATE_OBJECT',
      objectId,
      objectType: obj.type,
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      rotation,
      color: obj.color,
      strokeColor: obj.strokeColor,
      strokeWidth: obj.strokeWidth,
      text: obj.text,
      textColor: obj.textColor,
    });
  }, [store]);

  const handleDeleteObject = useCallback((objectId: string) => {
    store.getState().optimisticDelete(objectId);
    wsRef.current?.send({
      type: 'DELETE_OBJECT',
      objectId,
    });
  }, [store]);

  const handleDelete = useCallback(() => {
    const id = store.getState().selectedObjectId;
    if (id) handleDeleteObject(id);
  }, [store, handleDeleteObject]);

  const handleUndo = useCallback(() => {
    wsRef.current?.send({ type: 'UNDO' });
  }, []);

  const handleRedo = useCallback(() => {
    wsRef.current?.send({ type: 'REDO' });
  }, []);

  const handlePresenceUpdate = useCallback((cursor: Point) => {
    // The current backend rejects PRESENCE messages. Keep this callback as the
    // integration point for the server-side presence passthrough.
    void cursor;
  }, []);

  const handleUpdateStyle = useCallback(
    (objectId: string, fields: Partial<Pick<CanvasObject, 'color' | 'strokeColor' | 'strokeWidth' | 'textColor'>>) => {
      const s = store.getState();
      const obj = s.objects.get(objectId);
      if (!obj) return;

      s.optimisticUpdate(objectId, fields);
      const merged = { ...obj, ...fields };

      wsRef.current?.send({
        type: 'UPDATE_OBJECT',
        objectId,
        objectType: merged.type,
        x: merged.x,
        y: merged.y,
        width: merged.width,
        height: merged.height,
        rotation: merged.rotation,
        color: merged.color,
        strokeColor: merged.strokeColor,
      strokeWidth: merged.strokeWidth,
      text: merged.text,
      textColor: merged.textColor,
    });
    },
    [store],
  );

  const handleUpdateText = useCallback(
    (objectId: string, text: string) => {
      const s = store.getState();
      const obj = s.objects.get(objectId);
      if (!obj) return;

      s.optimisticUpdate(objectId, { text });
      const merged = { ...obj, text };

      wsRef.current?.send({
        type: 'UPDATE_OBJECT',
        objectId,
        objectType: merged.type,
        x: merged.x,
        y: merged.y,
        width: merged.width,
        height: merged.height,
        rotation: merged.rotation,
        color: merged.color,
        strokeColor: merged.strokeColor,
      strokeWidth: merged.strokeWidth,
      text: merged.text,
      textColor: merged.textColor,
    });
    },
    [store],
  );

  // ── Render ──
  if (appState === 'entry') {
    return (
      <CanvasEntryScreen
        onJoinCanvas={handleJoinCanvas}
        initialJoinId={pendingJoinId ?? undefined}
        initialError={linkError ?? undefined}
        resolving={resolvingLink}
      />
    );
  }

  return (
    <>
      <CanvasSurface
        onCreateObject={handleCreateObject}
        onMoveObject={handleMoveObject}
        onResizeObject={handleResizeObject}
        onRotateObject={handleRotateObject}
        onUpdateText={handleUpdateText}
        onPresenceUpdate={handlePresenceUpdate}
      />
      <Toolbar onDelete={handleDelete} onUndo={handleUndo} onRedo={handleRedo} />
      <StylePanel onUpdateStyle={handleUpdateStyle} />
    </>
  );
}
