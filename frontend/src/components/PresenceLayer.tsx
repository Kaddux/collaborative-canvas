import { useCanvasStore } from '../store/canvasStore';
import './PresenceLayer.css';

/**
 * SVG overlay that renders remote peer cursors.
 * Positioned inside the viewport-transformed <g>, so coordinates are in canvas space.
 */
export default function PresenceLayer() {
  const peers = useCanvasStore((s) => s.peers);

  const visiblePeers = Array.from(peers.values()).filter((p) => p.cursor !== null);

  if (visiblePeers.length === 0) return null;

  return (
    <g className="presence-layer">
      {visiblePeers.map((peer) => {
        const { cursor, color, clientId } = peer;
        if (!cursor) return null;
        const shortId = clientId.slice(0, 6);

        return (
          <g
            key={clientId}
            className="presence-cursor"
            style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
          >
            {/* Cursor arrow */}
            <path
              d="M0 0 L0 14 L4 10 L8 16 L10 15 L6 9 L11 9 Z"
              fill={color}
              stroke="rgba(0,0,0,0.3)"
              strokeWidth="0.5"
            />
            {/* Name label */}
            <rect
              className="presence-cursor-label-bg"
              x="12"
              y="14"
              width={shortId.length * 7 + 8}
              height="18"
              fill={color}
              opacity="0.9"
            />
            <text
              className="presence-cursor-label"
              x="16"
              y="27"
            >
              {shortId}
            </text>
          </g>
        );
      })}
    </g>
  );
}
