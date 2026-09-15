import { useEffect, useCallback, type ReactElement } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import type { Tool } from '../types/canvas';
import './Toolbar.css';

interface Props {
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

const TOOLS: { tool: Tool; label: string; shortcut: string; icon: ReactElement }[] = [
  {
    tool: 'SELECT',
    label: 'Select',
    shortcut: 'V',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
      </svg>
    ),
  },
  {
    tool: 'RECTANGLE',
    label: 'Rectangle',
    shortcut: 'R',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
      </svg>
    ),
  },
  {
    tool: 'ELLIPSE',
    label: 'Ellipse',
    shortcut: 'E',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="12" rx="10" ry="8" />
      </svg>
    ),
  },
  {
    tool: 'DIAMOND',
    label: 'Diamond',
    shortcut: 'D',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l10 10-10 10L2 12z" />
      </svg>
    ),
  },
  {
    tool: 'ARROW',
    label: 'Arrow',
    shortcut: 'A',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="19" x2="19" y2="5" />
        <polyline points="12 5 19 5 19 12" />
      </svg>
    ),
  },
  {
    tool: 'TEXT',
    label: 'Text',
    shortcut: 'T',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 7 4 4 20 4 20 7" />
        <line x1="12" y1="4" x2="12" y2="20" />
        <line x1="8" y1="20" x2="16" y2="20" />
      </svg>
    ),
  },
  {
    tool: 'STICKY_NOTE',
    label: 'Sticky Note',
    shortcut: 'S',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3z" />
        <polyline points="14 3 14 8 21 8" />
      </svg>
    ),
  },
];

export default function Toolbar({ onDelete, onUndo, onRedo }: Props) {
  const activeTool = useCanvasStore((s) => s.activeTool);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const selectedObjectId = useCanvasStore((s) => s.selectedObjectId);
  const canUndo = useCanvasStore((s) => s.canUndo);
  const canRedo = useCanvasStore((s) => s.canRedo);
  const peers = useCanvasStore((s) => s.peers);
  const connected = useCanvasStore((s) => s.connected);
  const canvasName = useCanvasStore((s) => s.canvasName);

  const handleKeyboard = useCallback(
    (e: KeyboardEvent) => {
      // Don't capture when typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      const modifier = e.ctrlKey || e.metaKey;
      if (modifier) {
        const shortcut = e.key.toUpperCase();
        if (shortcut === 'Z') {
          e.preventDefault();
          if (e.shiftKey) onRedo();
          else onUndo();
        } else if (shortcut === 'Y') {
          e.preventDefault();
          onRedo();
        }
        return;
      }

      const key = e.key.toUpperCase();
      const toolMap: Record<string, Tool> = {
        V: 'SELECT',
        R: 'RECTANGLE',
        E: 'ELLIPSE',
        D: 'DIAMOND',
        A: 'ARROW',
        T: 'TEXT',
        S: 'STICKY_NOTE',
      };

      if (toolMap[key]) {
        setActiveTool(toolMap[key]);
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjectId) {
        e.preventDefault();
        onDelete();
      }
    },
    [setActiveTool, selectedObjectId, onDelete, onUndo, onRedo],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [handleKeyboard]);

  const peerEntries = Array.from(peers.values());

  return (
    <div className="toolbar" id="main-toolbar">
      {canvasName && <span className="toolbar-canvas-name">{canvasName}</span>}
      <div className="toolbar-sep" />

      {TOOLS.map(({ tool, label, shortcut, icon }) => (
        <button
          key={tool}
          id={`tool-${tool.toLowerCase()}`}
          className={`toolbar-btn ${activeTool === tool ? 'active' : ''}`}
          title={`${label} (${shortcut})`}
          onClick={() => setActiveTool(tool)}
        >
          {icon}
          <span className="toolbar-shortcut">{shortcut}</span>
        </button>
      ))}

      <div className="toolbar-sep" />

      <button
        id="tool-undo"
        className="toolbar-btn"
        title="Undo (Ctrl+Z)"
        disabled={!canUndo}
        onClick={onUndo}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 14 4 9 9 4" />
          <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
        </svg>
      </button>

      <button
        id="tool-redo"
        className="toolbar-btn"
        title="Redo (Ctrl+Shift+Z)"
        disabled={!canRedo}
        onClick={onRedo}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 14 20 9 15 4" />
          <path d="M20 9H9a5 5 0 0 0 0 10h3" />
        </svg>
      </button>

      <button
        id="tool-delete"
        className="toolbar-btn delete-btn"
        title="Delete (Del)"
        disabled={!selectedObjectId}
        onClick={onDelete}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>

      {peerEntries.length > 0 && (
        <>
          <div className="toolbar-sep" />
          <div className="toolbar-presence">
            {peerEntries.map((peer) => (
              <div
                key={peer.clientId}
                className="presence-dot"
                style={{ background: peer.color }}
                title={peer.clientId}
              />
            ))}
          </div>
        </>
      )}

      <div
        className={`connection-indicator ${connected ? 'connected' : 'disconnected'}`}
        title={connected ? 'Connected' : 'Disconnected'}
      />
    </div>
  );
}
