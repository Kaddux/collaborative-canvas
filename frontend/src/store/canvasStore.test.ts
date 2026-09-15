import { beforeEach, describe, expect, it } from 'vitest';
import { useCanvasStore } from './canvasStore';

describe('canvasStore undo/redo availability', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset();
  });

  it('starts with both flags disabled', () => {
    const state = useCanvasStore.getState();
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
  });

  it('tracks server-provided history state', () => {
    useCanvasStore.getState().setHistoryState(true, false);
    expect(useCanvasStore.getState().canUndo).toBe(true);
    expect(useCanvasStore.getState().canRedo).toBe(false);

    useCanvasStore.getState().setHistoryState(false, true);
    expect(useCanvasStore.getState().canUndo).toBe(false);
    expect(useCanvasStore.getState().canRedo).toBe(true);
  });

  it('clears history flags on reset', () => {
    useCanvasStore.getState().setHistoryState(true, true);
    useCanvasStore.getState().reset();

    const state = useCanvasStore.getState();
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
  });
});
