import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useCanvasStore } from '../store/canvasStore';
import type { CanvasObject } from '../types/canvas';
import './StylePanel.css';

// Single paired palette: each stroke shares a row position with its matching pastel fill.
const PALETTE = [
  { stroke: '#1E1E1E', fill: '#FFFFFF' },
  { stroke: '#E03131', fill: '#FFC9C9' },
  { stroke: '#FFFFFF', fill: '#B2F2BB' },
  { stroke: '#1971C2', fill: '#A5D8FF' },
  { stroke: '#F08C00', fill: '#FFEC99' },
  { stroke: '#9C36B5', fill: '#EEBEFA' },
] as const;

// Text colors reuse the saturated/ink stroke palette so text stays readable.
const TEXT_COLORS = PALETTE.map(({ stroke }) => stroke);

const sameColor = (a: string | null | undefined, b: string) =>
  (a ?? '').toLowerCase() === b.toLowerCase();

const STROKE_WIDTHS = [
  { label: 'Thin', value: 1 },
  { label: 'Medium', value: 2 },
  { label: 'Thick', value: 4 },
  { label: 'Bold', value: 6 },
];

const PANEL_WIDTH = 260;
const EDGE_MARGIN = 16;
const DEFAULT_TOP = 80;

interface Props {
  onUpdateStyle: (objectId: string, fields: Partial<Pick<CanvasObject, 'color' | 'strokeColor' | 'strokeWidth' | 'textColor'>>) => void;
}

export default function StylePanel({ onUpdateStyle }: Props) {
  const selectedObjectId = useCanvasStore((s) => s.selectedObjectId);
  const objects = useCanvasStore((s) => s.objects);

  const selectedObject = selectedObjectId ? objects.get(selectedObjectId) : null;
  const isOpen = selectedObject !== null && selectedObject !== undefined;

  // Panel position, draggable across the canvas. Starts docked to the right.
  const [pos, setPos] = useState(() => ({
    x: Math.max(EDGE_MARGIN, window.innerWidth - PANEL_WIDTH - EDGE_MARGIN),
    y: DEFAULT_TOP,
  }));
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const clamp = useCallback((x: number, y: number) => {
    const maxX = Math.max(EDGE_MARGIN, window.innerWidth - PANEL_WIDTH - EDGE_MARGIN);
    // Keep the drag header reachable even when dragged toward the bottom.
    const maxY = Math.max(EDGE_MARGIN, window.innerHeight - 80);
    return {
      x: Math.min(Math.max(EDGE_MARGIN, x), maxX),
      y: Math.min(Math.max(EDGE_MARGIN, y), maxY),
    };
  }, []);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origX: pos.x,
        origY: pos.y,
      };
    },
    [pos.x, pos.y],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      setPos(
        clamp(
          drag.origX + (e.clientX - drag.startX),
          drag.origY + (e.clientY - drag.startY),
        ),
      );
    },
    [clamp],
  );

  const handlePointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  useEffect(() => {
    const handleResize = () => setPos((p) => clamp(p.x, p.y));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clamp]);

  return (
    <div
      className={`style-panel ${isOpen ? 'open' : ''}`}
      id="style-panel"
      style={{ left: pos.x, top: pos.y }}
    >
      {selectedObject && (
        <>
          <div
            className="style-panel-object-type"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <span className="type-label">Style</span>
            <svg
              className="style-panel-grip"
              viewBox="0 0 10 16"
              width="10"
              height="16"
              aria-hidden="true"
            >
              <circle cx="2.5" cy="4" r="1.2" />
              <circle cx="7.5" cy="4" r="1.2" />
              <circle cx="2.5" cy="8" r="1.2" />
              <circle cx="7.5" cy="8" r="1.2" />
              <circle cx="2.5" cy="12" r="1.2" />
              <circle cx="7.5" cy="12" r="1.2" />
            </svg>
          </div>

          {selectedObject.type !== 'TEXT' && (
            <>
              <h3>Fill</h3>
              <div className="color-swatches">
                {PALETTE.map(({ fill }) => (
                  <div
                    key={fill}
                    className={`color-swatch ${sameColor(selectedObject.color, fill) ? 'active' : ''}`}
                    style={{ background: fill }}
                    onClick={() => onUpdateStyle(selectedObject.objectId, { color: fill })}
                  />
                ))}
              </div>
            </>
          )}

          {(selectedObject.type === 'TEXT' || selectedObject.type === 'STICKY_NOTE') && (
            <>
              <h3>Text</h3>
              <div className="color-swatches">
                {TEXT_COLORS.map((c) => (
                  <div
                    key={c}
                    className={`color-swatch ${sameColor(selectedObject.textColor, c) ? 'active' : ''}`}
                    style={{ background: c }}
                    onClick={() => onUpdateStyle(selectedObject.objectId, { textColor: c })}
                  />
                ))}
              </div>
            </>
          )}

          <h3>Stroke</h3>
          <div className="color-swatches">
            {PALETTE.map(({ stroke }) => (
              <div
                key={stroke}
                className={`color-swatch ${sameColor(selectedObject.strokeColor, stroke) ? 'active' : ''}`}
                style={{ background: stroke }}
                onClick={() => onUpdateStyle(selectedObject.objectId, { strokeColor: stroke })}
              />
            ))}
          </div>

          <h3>Stroke Width</h3>
          <div className="stroke-options">
            {STROKE_WIDTHS.map(({ label, value }) => (
              <div
                key={value}
                className={`stroke-option ${selectedObject.strokeWidth === value ? 'active' : ''}`}
                onClick={() => onUpdateStyle(selectedObject.objectId, { strokeWidth: value })}
              >
                {label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
