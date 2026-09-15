import { useCanvasStore } from '../store/canvasStore';
import type { CanvasObject } from '../types/canvas';
import './StylePanel.css';

// Single paired palette: each stroke shares a row position with its matching pastel fill.
const PALETTE = [
  { stroke: '#1E1E1E', fill: '#FFFFFF' },
  { stroke: '#E03131', fill: '#FFC9C9' },
  { stroke: '#2F9E44', fill: '#B2F2BB' },
  { stroke: '#1971C2', fill: '#A5D8FF' },
  { stroke: '#F08C00', fill: '#FFEC99' },
  { stroke: '#9C36B5', fill: '#EEBEFA' },
] as const;

const sameColor = (a: string | null | undefined, b: string) =>
  (a ?? '').toLowerCase() === b.toLowerCase();

const STROKE_WIDTHS = [
  { label: 'Thin', value: 1 },
  { label: 'Medium', value: 2 },
  { label: 'Thick', value: 4 },
  { label: 'Bold', value: 6 },
];

interface Props {
  onUpdateStyle: (objectId: string, fields: Partial<Pick<CanvasObject, 'color' | 'strokeColor' | 'strokeWidth'>>) => void;
}

export default function StylePanel({ onUpdateStyle }: Props) {
  const selectedObjectId = useCanvasStore((s) => s.selectedObjectId);
  const objects = useCanvasStore((s) => s.objects);

  const selectedObject = selectedObjectId ? objects.get(selectedObjectId) : null;
  const isOpen = selectedObject !== null && selectedObject !== undefined;

  return (
    <div className={`style-panel ${isOpen ? 'open' : ''}`} id="style-panel">
      {selectedObject && (
        <>
          <div className="style-panel-object-type">
            <span className="type-label">
              {selectedObject.type.replace('_', ' ')}
            </span>
          </div>

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
