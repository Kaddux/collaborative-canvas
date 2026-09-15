import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
} from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { screenToCanvas } from '../utils/transform';
import { generateObjectId } from '../utils/idgen';
import { hashClientIdToColor } from '../utils/colors';
import type { CanvasObject, CanvasObjectType, Point } from '../types/canvas';
import PresenceLayer from './PresenceLayer';
import './CanvasSurface.css';

interface Props {
  onCreateObject: (obj: CanvasObject) => void;
  onMoveObject: (objectId: string, x: number, y: number) => void;
  onResizeObject: (objectId: string, x: number, y: number, width: number, height: number) => void;
  onUpdateText: (objectId: string, text: string) => void;
  onPresenceUpdate: (cursor: Point) => void;
}

interface DrawState {
  startCanvas: Point;
  currentCanvas: Point;
  objectId: string;
  objectType: CanvasObjectType;
}

interface DragState {
  objectId: string;
  startCanvas: Point;
  objectStartX: number;
  objectStartY: number;
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

interface ResizeState {
  objectId: string;
  handle: ResizeHandle;
  startCanvas: Point;
  objectStartX: number;
  objectStartY: number;
  objectStartWidth: number;
  objectStartHeight: number;
}

const GRID_SIZE = 20;
const MIN_OBJECT_SIZE = 20;

export default function CanvasSurface({
  onCreateObject,
  onMoveObject,
  onResizeObject,
  onUpdateText,
  onPresenceUpdate,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  const objects = useCanvasStore((s) => s.objects);
  const activeTool = useCanvasStore((s) => s.activeTool);
  const selectedObjectId = useCanvasStore((s) => s.selectedObjectId);
  const viewport = useCanvasStore((s) => s.viewport);
  const setSelectedObjectId = useCanvasStore((s) => s.setSelectedObjectId);
  const optimisticMove = useCanvasStore((s) => s.optimisticMove);
  const optimisticUpdate = useCanvasStore((s) => s.optimisticUpdate);
  const beginResize = useCanvasStore((s) => s.beginResize);
  const panViewport = useCanvasStore((s) => s.panViewport);
  const zoomViewport = useCanvasStore((s) => s.zoomViewport);
  const remoteEditHighlights = useCanvasStore((s) => s.remoteEditHighlights);

  const [drawState, setDrawState] = useState<DrawState | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // ── Text editing state ──
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');
  // Tracks the active edit id synchronously so a commit followed by unmount-blur
  // doesn't send the update twice.
  const editingTextIdRef = useRef<string | null>(null);

  // ── Space key for pan ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  // ── Presence throttle ──
  const lastPresenceRef = useRef(0);
  const sendPresence = useCallback(
    (screenX: number, screenY: number) => {
      const now = Date.now();
      if (now - lastPresenceRef.current < 50) return; // 20 fps cap
      lastPresenceRef.current = now;
      const canvas = screenToCanvas(screenX, screenY, viewport);
      onPresenceUpdate(canvas);
    },
    [viewport, onPresenceUpdate],
  );

  // ── Mouse down ──
  const handleMouseDown = useCallback(
    (e: ReactMouseEvent<SVGSVGElement>) => {
      if (e.button === 1 || (e.button === 0 && spaceDown)) {
        // Middle mouse or space+left = pan
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY });
        return;
      }

      if (e.button !== 0) return;

      const canvasPoint = screenToCanvas(e.clientX, e.clientY, viewport);

      if (activeTool === 'SELECT') {
        // Check if clicking on an object (handled by object click handler)
        // If clicking on empty space, deselect
        const target = e.target as SVGElement;
        if (!target.closest('.canvas-object')) {
          setSelectedObjectId(null);
        }
        return;
      }

      // Drawing a new shape
      const objectType = activeTool as CanvasObjectType;
      setDrawState({
        startCanvas: canvasPoint,
        currentCanvas: canvasPoint,
        objectId: generateObjectId(),
        objectType,
      });
    },
    [activeTool, spaceDown, viewport, setSelectedObjectId],
  );

  // ── Mouse move ──
  const handleMouseMove = useCallback(
    (e: ReactMouseEvent<SVGSVGElement>) => {
      sendPresence(e.clientX, e.clientY);

      if (isPanning && panStart) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        panViewport(dx, dy);
        setPanStart({ x: e.clientX, y: e.clientY });
        return;
      }

      if (drawState) {
        const canvasPoint = screenToCanvas(e.clientX, e.clientY, viewport);
        setDrawState((prev) => (prev ? { ...prev, currentCanvas: canvasPoint } : null));
        return;
      }

      if (resizeState) {
        const canvasPoint = screenToCanvas(e.clientX, e.clientY, viewport);
        const right = resizeState.objectStartX + resizeState.objectStartWidth;
        const bottom = resizeState.objectStartY + resizeState.objectStartHeight;
        let x = resizeState.objectStartX;
        let y = resizeState.objectStartY;
        let width = resizeState.objectStartWidth;
        let height = resizeState.objectStartHeight;

        if (resizeState.handle.includes('e')) {
          width = Math.max(MIN_OBJECT_SIZE, canvasPoint.x - x);
        } else {
          x = Math.min(canvasPoint.x, right - MIN_OBJECT_SIZE);
          width = right - x;
        }

        if (resizeState.handle.includes('s')) {
          height = Math.max(MIN_OBJECT_SIZE, canvasPoint.y - y);
        } else {
          y = Math.min(canvasPoint.y, bottom - MIN_OBJECT_SIZE);
          height = bottom - y;
        }

        optimisticUpdate(resizeState.objectId, { x, y, width, height });
        return;
      }

      if (dragState) {
        const canvasPoint = screenToCanvas(e.clientX, e.clientY, viewport);
        const dx = canvasPoint.x - dragState.startCanvas.x;
        const dy = canvasPoint.y - dragState.startCanvas.y;
        const newX = dragState.objectStartX + dx;
        const newY = dragState.objectStartY + dy;
        optimisticMove(dragState.objectId, newX, newY);
        return;
      }
    },
    [isPanning, panStart, drawState, resizeState, dragState, viewport, panViewport, optimisticUpdate, optimisticMove, sendPresence],
  );

  // ── Mouse up ──
  const handleMouseUp = useCallback(
    () => {
      if (isPanning) {
        setIsPanning(false);
        setPanStart(null);
        return;
      }

      if (drawState) {
        const { startCanvas, currentCanvas, objectId, objectType } = drawState;
        const x = Math.min(startCanvas.x, currentCanvas.x);
        const y = Math.min(startCanvas.y, currentCanvas.y);
        const width = Math.max(Math.abs(currentCanvas.x - startCanvas.x), 20);
        const height = Math.max(Math.abs(currentCanvas.y - startCanvas.y), 20);

        const defaults: Record<string, Partial<CanvasObject>> = {
          STICKY_NOTE: {
            color: '#fff3bf',
            strokeColor: '#f08c00',
            strokeWidth: 1,
            width: Math.max(width, 150),
            height: Math.max(height, 100),
          },
          TEXT: {
            color: 'transparent',
            strokeColor: 'transparent',
            strokeWidth: 0,
            width: Math.max(width, 120),
            height: Math.max(height, 30),
          },
        };

        const typeDefaults = defaults[objectType] || {};

        const newObj: CanvasObject = {
          objectId,
          type: objectType,
          x,
          y,
          width: typeDefaults.width ?? width,
          height: typeDefaults.height ?? height,
          rotation: 0,
          color: typeDefaults.color ?? '#ffffff',
          strokeColor: typeDefaults.strokeColor ?? '#1E1E1E',
          strokeWidth: typeDefaults.strokeWidth ?? 2,
          text: null,
        };

        onCreateObject(newObj);
        setDrawState(null);
        return;
      }

      if (resizeState) {
        const obj = objects.get(resizeState.objectId);
        if (obj) {
          onResizeObject(resizeState.objectId, obj.x, obj.y, obj.width, obj.height);
        }
        setResizeState(null);
        return;
      }

      if (dragState) {
        const obj = objects.get(dragState.objectId);
        if (obj) {
          onMoveObject(dragState.objectId, obj.x, obj.y);
        }
        setDragState(null);
        return;
      }
    },
    [isPanning, drawState, resizeState, dragState, objects, onCreateObject, onResizeObject, onMoveObject],
  );

  // ── Mouse wheel (zoom) ──
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      zoomViewport(factor, e.clientX, e.clientY);
    },
    [zoomViewport],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ── Object click (select) ──
  const handleObjectClick = useCallback(
    (objectId: string, e: ReactMouseEvent) => {
      e.stopPropagation();
      if (activeTool === 'SELECT') {
        setSelectedObjectId(objectId);
      }
    },
    [activeTool, setSelectedObjectId],
  );

  // ── Object drag start ──
  const handleObjectMouseDown = useCallback(
    (objectId: string, e: ReactMouseEvent) => {
      if (activeTool !== 'SELECT') return;
      if (e.button !== 0) return;
      e.stopPropagation();

      const obj = objects.get(objectId);
      if (!obj) return;

      setSelectedObjectId(objectId);
      beginResize(objectId);
      const canvasPoint = screenToCanvas(e.clientX, e.clientY, viewport);
      setDragState({
        objectId,
        startCanvas: canvasPoint,
        objectStartX: obj.x,
        objectStartY: obj.y,
      });
    },
    [activeTool, objects, viewport, beginResize, setSelectedObjectId],
  );

  const handleResizeMouseDown = useCallback(
    (objectId: string, handle: ResizeHandle, e: ReactMouseEvent) => {
      if (activeTool !== 'SELECT' || e.button !== 0) return;
      e.stopPropagation();

      const obj = objects.get(objectId);
      if (!obj) return;

      setSelectedObjectId(objectId);
      const canvasPoint = screenToCanvas(e.clientX, e.clientY, viewport);
      setResizeState({
        objectId,
        handle,
        startCanvas: canvasPoint,
        objectStartX: obj.x,
        objectStartY: obj.y,
        objectStartWidth: obj.width,
        objectStartHeight: obj.height,
      });
    },
    [activeTool, objects, viewport, setSelectedObjectId],
  );

  // ── Double-click for text editing ──
  const handleObjectDoubleClick = useCallback(
    (objectId: string) => {
      const obj = objects.get(objectId);
      if (!obj) return;
      if (obj.type === 'TEXT' || obj.type === 'STICKY_NOTE') {
        editingTextIdRef.current = objectId;
        setEditingTextId(objectId);
        setEditingTextValue(obj.text ?? '');
      }
    },
    [objects],
  );

  const finishTextEdit = useCallback(
    (save: boolean) => {
      const id = editingTextIdRef.current;
      if (!id) return;
      editingTextIdRef.current = null;
      if (save) onUpdateText(id, editingTextValue);
      setEditingTextId(null);
    },
    [editingTextValue, onUpdateText],
  );

  // ── Cursor class ──
  const cursorClass = isPanning
    ? 'tool-panning'
    : spaceDown
      ? 'tool-pan'
      : activeTool === 'SELECT'
        ? 'tool-select'
        : 'tool-draw';

  // ── Render shape ──
  const renderShape = (obj: CanvasObject, isGhost = false) => {
    const { objectId, type, x, y, width, height, color, strokeColor, strokeWidth, text } = obj;
    const isSelected = objectId === selectedObjectId && !isGhost;
    const isEditing = objectId === editingTextId;
    const className = isGhost ? 'drawing-ghost' : `canvas-object ${isSelected ? 'selected' : ''}`;

    const commonProps = {
      className,
      onClick: isGhost ? undefined : (e: ReactMouseEvent) => handleObjectClick(objectId, e),
      onMouseDown: isGhost ? undefined : (e: ReactMouseEvent) => handleObjectMouseDown(objectId, e),
      onDoubleClick: isGhost ? undefined : () => handleObjectDoubleClick(objectId),
    };

    let shape: ReactElement;

    switch (type) {
      case 'RECTANGLE':
      case 'STICKY_NOTE':
        shape = (
          <g {...commonProps} data-object-id={objectId}>
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              fill={color}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              rx={type === 'STICKY_NOTE' ? 8 : 0}
            />
            {text && type === 'STICKY_NOTE' && (
              <text
                className="sticky-note-text"
                x={x + 10}
                y={y + 24}
                fill="#1e1e1e"
                style={{ fontSize: 14 }}
              >
                {text.split('\n').map((line, i) => (
                  <tspan key={i} x={x + 10} dy={i === 0 ? 0 : 18}>
                    {line}
                  </tspan>
                ))}
              </text>
            )}
          </g>
        );
        break;

      case 'ELLIPSE':
        shape = (
          <ellipse
            {...commonProps}
            data-object-id={objectId}
            cx={x + width / 2}
            cy={y + height / 2}
            rx={width / 2}
            ry={height / 2}
            fill={color}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        );
        break;

      case 'DIAMOND':
        shape = (
          <polygon
            {...commonProps}
            data-object-id={objectId}
            points={`${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}`}
            fill={color}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        );
        break;

      case 'LINE':
        shape = (
          <line
            {...commonProps}
            data-object-id={objectId}
            x1={x}
            y1={y}
            x2={x + width}
            y2={y + height}
            stroke={strokeColor}
            strokeWidth={Math.max(strokeWidth, 2)}
          />
        );
        break;

      case 'ARROW':
        shape = (
          <g {...commonProps} data-object-id={objectId}>
            <line
              x1={x}
              y1={y}
              x2={x + width}
              y2={y + height}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
            <polygon
              points={arrowHead(x, y, x + width, y + height, 12)}
              fill={strokeColor}
            />
          </g>
        );
        break;

      case 'TEXT':
        shape = (
          <g {...commonProps} data-object-id={objectId}>
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              fill="transparent"
              stroke={isSelected ? 'transparent' : 'transparent'}
              strokeWidth={0}
            />
            {!isEditing &&
              (text ? (
                <text
                  x={x + 4}
                  y={y + 20}
                  fill="#1e1e1e"
                  style={{ fontSize: 16, fontFamily: 'Inter, system-ui, sans-serif' }}
                >
                  {text}
                </text>
              ) : (
                !isGhost && (
                  <text
                    className="text-placeholder"
                    x={x + 4}
                    y={y + 20}
                    style={{ fontSize: 16, fontFamily: 'Inter, system-ui, sans-serif' }}
                  >
                    Double-click to edit
                  </text>
                )
              ))}
          </g>
        );
        break;

      default:
        shape = (
          <rect
            {...commonProps}
            data-object-id={objectId}
            x={x}
            y={y}
            width={width}
            height={height}
            fill={color}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        );
    }

    return shape;
  };

  // All objects as array for rendering
  const objectsArray = Array.from(objects.values());

  // Drawing ghost preview
  const ghostObj: CanvasObject | null = drawState
    ? {
        objectId: drawState.objectId,
        type: drawState.objectType,
        x: Math.min(drawState.startCanvas.x, drawState.currentCanvas.x),
        y: Math.min(drawState.startCanvas.y, drawState.currentCanvas.y),
        width: Math.abs(drawState.currentCanvas.x - drawState.startCanvas.x),
        height: Math.abs(drawState.currentCanvas.y - drawState.startCanvas.y),
        rotation: 0,
        color: '#ffffff',
        strokeColor: '#4263eb',
        strokeWidth: 2,
        text: null,
      }
    : null;

  // Selected object for handles
  const selectedObj = selectedObjectId ? objects.get(selectedObjectId) : null;

  // Remote edit highlights
  const activeHighlights = Array.from(remoteEditHighlights.entries()).filter(
    ([, h]) => h.expiry > currentTime,
  );

  return (
    <div className={`canvas-container ${cursorClass}`}>
      <svg
        ref={svgRef}
        className="canvas-svg"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <pattern
            id="grid-pattern"
            width={GRID_SIZE}
            height={GRID_SIZE}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${viewport.offsetX},${viewport.offsetY}) scale(${viewport.zoom})`}
          >
            <circle cx={GRID_SIZE / 2} cy={GRID_SIZE / 2} r={1} fill="rgba(255,255,255,0.06)" />
          </pattern>
        </defs>

        {/* Grid background */}
        <rect width="100%" height="100%" fill="url(#grid-pattern)" />

        {/* Viewport-transformed group */}
        <g
          transform={`translate(${viewport.offsetX},${viewport.offsetY}) scale(${viewport.zoom})`}
        >
          {/* Existing objects */}
          {objectsArray.map((obj) => (
            <g key={obj.objectId}>{renderShape(obj)}</g>
          ))}

          {/* Ghost preview while drawing */}
          {ghostObj && renderShape(ghostObj, true)}

          {/* Selection outline + handles */}
          {selectedObj && !dragState && !resizeState && (
            <g>
              <rect
                className="selection-outline"
                x={selectedObj.x - 2}
                y={selectedObj.y - 2}
                width={selectedObj.width + 4}
                height={selectedObj.height + 4}
                rx={selectedObj.type === 'STICKY_NOTE' ? 10 : 0}
              />
              {/* Corner handles */}
              {[
                [selectedObj.x - 4, selectedObj.y - 4],
                [selectedObj.x + selectedObj.width, selectedObj.y - 4],
                [selectedObj.x - 4, selectedObj.y + selectedObj.height],
                [selectedObj.x + selectedObj.width, selectedObj.y + selectedObj.height],
              ].map(([hx, hy], i) => (
                <rect
                  key={i}
                  className={`resize-handle resize-handle-${(['nw', 'ne', 'sw', 'se'] as ResizeHandle[])[i]}`}
                  onMouseDown={(e) => handleResizeMouseDown(
                    selectedObj.objectId,
                    (['nw', 'ne', 'sw', 'se'] as ResizeHandle[])[i],
                    e,
                  )}
                  x={hx}
                  y={hy}
                  width={8}
                  height={8}
                  rx={2}
                />
              ))}
            </g>
          )}

          {/* Remote edit highlights */}
          {activeHighlights.map(([objectId, highlight]) => {
            const obj = objects.get(objectId);
            if (!obj) return null;
            const peerColor = hashClientIdToColor(highlight.clientId);
            return (
              <rect
                key={`highlight-${objectId}`}
                className="remote-edit-highlight"
                x={obj.x - 4}
                y={obj.y - 4}
                width={obj.width + 8}
                height={obj.height + 8}
                stroke={peerColor}
              />
            );
          })}

          {/* Presence cursors */}
          <PresenceLayer />
        </g>

        {/* Text editing overlay */}
        {editingTextId && (() => {
          const obj = objects.get(editingTextId);
          if (!obj) return null;
          const screenX = obj.x * viewport.zoom + viewport.offsetX;
          const screenY = obj.y * viewport.zoom + viewport.offsetY;
          const screenW = obj.width * viewport.zoom;
          const screenH = obj.height * viewport.zoom;
          return (
            <foreignObject x={screenX} y={screenY} width={screenW} height={screenH}>
              <textarea
                className="text-edit-overlay"
                style={{ width: '100%', height: '100%' }}
                value={editingTextValue}
                onChange={(e) => setEditingTextValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    finishTextEdit(false);
                  } else if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    finishTextEdit(true);
                  }
                }}
                onBlur={() => finishTextEdit(true)}
                autoFocus
              />
            </foreignObject>
          );
        })()}
      </svg>
    </div>
  );
}

/** Compute arrowhead polygon points */
function arrowHead(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size: number,
): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const p1x = x2 - size * Math.cos(angle - Math.PI / 6);
  const p1y = y2 - size * Math.sin(angle - Math.PI / 6);
  const p2x = x2 - size * Math.cos(angle + Math.PI / 6);
  const p2y = y2 - size * Math.sin(angle + Math.PI / 6);
  return `${x2},${y2} ${p1x},${p1y} ${p2x},${p2y}`;
}
