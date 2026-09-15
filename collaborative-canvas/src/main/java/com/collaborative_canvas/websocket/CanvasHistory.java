package com.collaborative_canvas.websocket;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Per-canvas, per-client undo/redo history of successfully applied operations.
 *
 * <p>History is scoped per client: a client may only undo operations it authored. Each entry
 * keeps full before/after object snapshots, so an inverse can be synthesized generically
 * without per-operation-type knowledge.
 *
 * <p>This history is in-memory and lives only as long as the canvas room. It is deliberately
 * separate from the durable Kafka operation log, which exists for audit/replay.
 */
public class CanvasHistory {

    private static final int MAX_HISTORY = 100;

    private final Map<String, Deque<Entry>> undoByClient = new ConcurrentHashMap<>();
    private final Map<String, Deque<Entry>> redoByClient = new ConcurrentHashMap<>();

    private static final class Entry {
        final CanvasOperation original;
        final CanvasObject before;
        final CanvasObject after;

        Entry(CanvasOperation original, CanvasObject before, CanvasObject after) {
            this.original = original;
            this.before = before;
            this.after = after;
        }
    }

    /** Records a successfully applied operation and clears the client's redo stack. */
    public synchronized void record(
            String clientId,
            CanvasOperation operation,
            CanvasObject before,
            CanvasObject after) {

        if (clientId == null || operation == null) {
            return;
        }

        Deque<Entry> undo = undoByClient.computeIfAbsent(clientId, key -> new ArrayDeque<>());
        undo.push(new Entry(operation, before, after));
        while (undo.size() > MAX_HISTORY) {
            undo.removeLast();
        }
        redoByClient.remove(clientId);
    }

    /**
     * Pops the client's most recent operation and returns the operation that reverses it,
     * or {@code null} when there is nothing to undo.
     */
    public synchronized CanvasOperation undo(String clientId) {
        if (clientId == null) {
            return null;
        }
        Deque<Entry> undo = undoByClient.get(clientId);
        if (undo == null || undo.isEmpty()) {
            return null;
        }
        Entry entry = undo.pop();
        redoByClient.computeIfAbsent(clientId, key -> new ArrayDeque<>()).push(entry);
        return inverseOf(entry);
    }

    /**
     * Pops the client's most recently undone operation and returns the operation that
     * re-applies it, or {@code null} when there is nothing to redo.
     */
    public synchronized CanvasOperation redo(String clientId) {
        if (clientId == null) {
            return null;
        }
        Deque<Entry> redo = redoByClient.get(clientId);
        if (redo == null || redo.isEmpty()) {
            return null;
        }
        Entry entry = redo.pop();
        undoByClient.computeIfAbsent(clientId, key -> new ArrayDeque<>()).push(entry);
        return forwardOf(entry);
    }

    public synchronized boolean canUndo(String clientId) {
        return clientId != null && !isEmpty(undoByClient, clientId);
    }

    public synchronized boolean canRedo(String clientId) {
        return clientId != null && !isEmpty(redoByClient, clientId);
    }

    private boolean isEmpty(Map<String, Deque<Entry>> stacks, String clientId) {
        Deque<Entry> stack = stacks.get(clientId);
        return stack == null || stack.isEmpty();
    }

    private static CanvasOperation inverseOf(Entry entry) {
        if (entry.before == null && entry.after != null) {
            return delete(entry.after);
        }
        if (entry.before != null && entry.after == null) {
            return create(entry.before);
        }
        return update(entry.before);
    }

    private static CanvasOperation forwardOf(Entry entry) {
        if (entry.before == null && entry.after != null) {
            return create(entry.after);
        }
        if (entry.before != null && entry.after == null) {
            return delete(entry.before);
        }
        return update(entry.after);
    }

    private static CanvasOperation create(CanvasObject object) {
        CanvasOperation operation = new CanvasOperation();
        operation.setType("CREATE_OBJECT");
        operation.setObjectId(object.getObjectId());
        operation.setObjectType(object.getType());
        copyGeometry(operation, object);
        return operation;
    }

    private static CanvasOperation delete(CanvasObject object) {
        CanvasOperation operation = new CanvasOperation();
        operation.setType("DELETE_OBJECT");
        operation.setObjectId(object.getObjectId());
        return operation;
    }

    private static CanvasOperation update(CanvasObject object) {
        CanvasOperation operation = new CanvasOperation();
        operation.setType("UPDATE_OBJECT");
        operation.setObjectId(object.getObjectId());
        operation.setObjectType(object.getType());
        copyGeometry(operation, object);
        return operation;
    }

    private static void copyGeometry(CanvasOperation operation, CanvasObject object) {
        operation.setX(object.getX());
        operation.setY(object.getY());
        operation.setWidth(object.getWidth());
        operation.setHeight(object.getHeight());
        operation.setRotation(object.getRotation());
        operation.setColor(object.getColor());
        operation.setStrokeColor(object.getStrokeColor());
        operation.setStrokeWidth(object.getStrokeWidth());
        operation.setText(object.getText());
        operation.setTextColor(object.getTextColor());
        operation.setFontSize(object.getFontSize());
    }
}
