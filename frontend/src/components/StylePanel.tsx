import { useCanvasStore } from '../store/canvasStore';
import type { CanvasObject } from '../types/canvas';
import './StylePanel.css';

const FILL_COLORS = [
  '#ffffff', '#f8f9fa', '#e9ecef', '#dee2e6',
  '#fff3bf', '#d3f9d8', '#d0ebff', '#e5dbff',
  '#ffc9c9', '#ffdeeb', '#c3fae8', '#a5d8ff',
];

const STROKE_COLORS = [
  '#000000', '#343a40', '#495057', '#868e96',
  '#e03131', '#2f9e44', '#1971c2', '#9c36b5',
  '#f08c00', '#0c8599', '#e8590c', '#6741d9',
];

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
            {FILL_COLORS.map((c) => (
              <div
                key={c}
                className={`color-swatch ${selectedObject.color === c ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => onUpdateStyle(selectedObject.objectId, { color: c })}
              />
            ))}
          </div>

          <h3>Stroke</h3>
          <div className="color-swatches">
            {STROKE_COLORS.map((c) => (
              <div
                key={c}
                className={`color-swatch ${selectedObject.strokeColor === c ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => onUpdateStyle(selectedObject.objectId, { strokeColor: c })}
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
