import { useState, type FormEvent } from 'react';
import type { CanvasMetadata } from '../types/canvas';
import './CanvasEntryScreen.css';

interface Props {
  onJoinCanvas: (meta: CanvasMetadata) => void;
  initialJoinId?: string;
  initialError?: string;
  resolving?: boolean;
}

export default function CanvasEntryScreen({
  onJoinCanvas,
  initialJoinId,
  initialError,
  resolving = false,
}: Props) {
  const [createName, setCreateName] = useState('');
  const [joinId, setJoinId] = useState(initialJoinId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Local errors (failed create/join) take precedence over one handed in by a failed share link.
  const shownError = error ?? initialError ?? null;

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!createName.trim() || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/canvases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName.trim() }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const meta: CanvasMetadata = await res.json();
      onJoinCanvas(meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create canvas');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (!joinId.trim() || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/canvases/${joinId.trim()}`);
      if (res.status === 404) {
        setError('Canvas not found. Check the ID and try again.');
        return;
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const meta: CanvasMetadata = await res.json();
      onJoinCanvas(meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join canvas');
    } finally {
      setLoading(false);
    }
  }

  if (resolving) {
    return (
      <div className="entry-screen">
        <div className="entry-card">
          <h1>Collaborative Canvas</h1>
          <p className="subtitle">Joining shared canvas…</p>
          <span className="entry-loading" />
        </div>
      </div>
    );
  }

  return (
    <div className="entry-screen">
      <div className="entry-card">
        <h1>Collaborative Canvas</h1>
        <p className="subtitle">Real-time whiteboard for your team</p>

        <div className="entry-section">
          <h2>Create new</h2>
          <form className="entry-row" onSubmit={handleCreate}>
            <input
              id="create-name-input"
              className="entry-input"
              type="text"
              placeholder="Canvas name…"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              disabled={loading}
            />
            <button
              id="create-canvas-btn"
              className="entry-btn"
              type="submit"
              disabled={!createName.trim() || loading}
            >
              {loading ? <span className="entry-loading" /> : null}
              Create
            </button>
          </form>
        </div>

        <div className="entry-divider">
          <span>or</span>
        </div>

        <div className="entry-section">
          <h2>Join existing</h2>
          <form className="entry-row" onSubmit={handleJoin}>
            <input
              id="join-id-input"
              className="entry-input"
              type="text"
              placeholder="Canvas ID…"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              disabled={loading}
            />
            <button
              id="join-canvas-btn"
              className="entry-btn"
              type="submit"
              disabled={!joinId.trim() || loading}
            >
              {loading ? <span className="entry-loading" /> : null}
              Join
            </button>
          </form>
        </div>

        {shownError && <div className="entry-error">{shownError}</div>}
      </div>
    </div>
  );
}
