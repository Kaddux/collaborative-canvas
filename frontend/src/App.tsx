import { useState, useEffect, useCallback, useRef } from 'react';
import { useCanvasStore } from './store/canvasStore';
import { CanvasWebSocketClient } from './ws/websocketClient';
import { generateClientId } from './utils/idgen';
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
  const wsRef = useRef<CanvasWebSocketClient | null>(null);

  const store = useCanvasStore;
  const clientId = useRef(generateClientId());

  // ── Join canvas ──
  const handleJoinCanvas = useCallback((meta: CanvasMetadata) => {
    const s = store.getState();
    s.setConnection(meta.canvasId, meta.name, clientId.current);
    setAppState('canvas');
  }, [store]);

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

            case 'ERROR':
              if (s.pendingResize) s.rollbackResize(s.pendingResize.objectId);
              s.handleError(typeof msg.payload === 'string' ? msg.payload : 'Unknown error');
              break;
          }
        },
        onCanvasNotFound: () => {
          alert('Canvas not found. Returning to home.');
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
    wsRef.current?.send({
      type: 'UPDATE_OBJECT',
      objectId,
      x,
      y,
      width,
      height,
    });
  }, []);

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

  const handlePresenceUpdate = useCallback((cursor: Point) => {
    // The current backend rejects PRESENCE messages. Keep this callback as the
    // integration point for the server-side presence passthrough.
    void cursor;
  }, []);

  const handleUpdateStyle = useCallback(
    (objectId: string, fields: Partial<Pick<CanvasObject, 'color' | 'strokeColor' | 'strokeWidth'>>) => {
      const s = store.getState();
      s.optimisticUpdate(objectId, fields);
    },
    [store],
  );

  // ── Render ──
  if (appState === 'entry') {
    return <CanvasEntryScreen onJoinCanvas={handleJoinCanvas} />;
  }

  return (
    <>
      <CanvasSurface
        onCreateObject={handleCreateObject}
        onMoveObject={handleMoveObject}
        onResizeObject={handleResizeObject}
        onPresenceUpdate={handlePresenceUpdate}
      />
      <Toolbar onDelete={handleDelete} />
      <StylePanel onUpdateStyle={handleUpdateStyle} />
    </>
  );
}
