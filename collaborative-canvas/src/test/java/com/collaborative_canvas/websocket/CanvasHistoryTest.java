package com.collaborative_canvas.websocket;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CanvasHistoryTest {

    private static final String CLIENT = "client-1";

    private CanvasHistory history;

    @BeforeEach
    void setUp() {
        history = new CanvasHistory();
    }

    @Test
    void emptyHistoryCannotUndoOrRedo() {
        assertFalse(history.canUndo(CLIENT));
        assertFalse(history.canRedo(CLIENT));
        assertNull(history.undo(CLIENT));
        assertNull(history.redo(CLIENT));
    }

    @Test
    void undoOfCreateProducesDelete() {
        CanvasObject created = object("object-1", 10, 20, 100, 50);
        history.record(CLIENT, operation("CREATE_OBJECT"), null, created);

        assertTrue(history.canUndo(CLIENT));

        CanvasOperation inverse = history.undo(CLIENT);

        assertEquals("DELETE_OBJECT", inverse.getType());
        assertEquals("object-1", inverse.getObjectId());
        assertFalse(history.canUndo(CLIENT));
        assertTrue(history.canRedo(CLIENT));
    }

    @Test
    void redoOfCreateRestoresFullSnapshot() {
        CanvasObject created = object("object-1", 10, 20, 100, 50);
        history.record(CLIENT, operation("CREATE_OBJECT"), null, created);

        history.undo(CLIENT);
        CanvasOperation forward = history.redo(CLIENT);

        assertEquals("CREATE_OBJECT", forward.getType());
        assertEquals("object-1", forward.getObjectId());
        assertEquals("RECTANGLE", forward.getObjectType());
        assertEquals(10, forward.getX());
        assertEquals(20, forward.getY());
        assertEquals(100, forward.getWidth());
        assertEquals(50, forward.getHeight());
        assertTrue(history.canUndo(CLIENT));
        assertFalse(history.canRedo(CLIENT));
    }

    @Test
    void undoOfDeleteRecreatesFromSnapshot() {
        CanvasObject deleted = object("object-1", 5, 6, 70, 80);
        history.record(CLIENT, operation("DELETE_OBJECT"), deleted, null);

        CanvasOperation inverse = history.undo(CLIENT);

        assertEquals("CREATE_OBJECT", inverse.getType());
        assertEquals("object-1", inverse.getObjectId());
        assertEquals(5, inverse.getX());
        assertEquals(6, inverse.getY());
        assertEquals(70, inverse.getWidth());
        assertEquals(80, inverse.getHeight());
    }

    @Test
    void undoAndRedoOfUpdateRestoreBeforeAndAfter() {
        CanvasObject before = object("object-1", 0, 0, 100, 50);
        CanvasObject after = object("object-1", 0, 0, 200, 150);
        history.record(CLIENT, operation("UPDATE_OBJECT"), before, after);

        CanvasOperation inverse = history.undo(CLIENT);
        assertEquals("UPDATE_OBJECT", inverse.getType());
        assertEquals(100, inverse.getWidth());
        assertEquals(50, inverse.getHeight());

        CanvasOperation forward = history.redo(CLIENT);
        assertEquals("UPDATE_OBJECT", forward.getType());
        assertEquals(200, forward.getWidth());
        assertEquals(150, forward.getHeight());
    }

    @Test
    void recordingNewOperationClearsRedoStack() {
        history.record(CLIENT, operation("CREATE_OBJECT"), null, object("object-1", 0, 0, 10, 10));
        history.undo(CLIENT);
        assertTrue(history.canRedo(CLIENT));

        history.record(CLIENT, operation("CREATE_OBJECT"), null, object("object-2", 0, 0, 10, 10));

        assertFalse(history.canRedo(CLIENT));
    }

    @Test
    void historyIsScopedPerClient() {
        history.record(CLIENT, operation("CREATE_OBJECT"), null, object("object-1", 0, 0, 10, 10));

        assertFalse(history.canUndo("client-2"));
        assertNull(history.undo("client-2"));
        assertTrue(history.canUndo(CLIENT));
    }

    @Test
    void nullClientIsIgnored() {
        history.record(null, operation("CREATE_OBJECT"), null, object("object-1", 0, 0, 10, 10));

        assertFalse(history.canUndo(null));
        assertFalse(history.canRedo(null));
    }

    private CanvasOperation operation(String type) {
        CanvasOperation operation = new CanvasOperation();
        operation.setType(type);
        operation.setObjectId("object-1");
        return operation;
    }

    private CanvasObject object(
            String objectId, double x, double y, double width, double height) {
        CanvasObject object = new CanvasObject();
        object.setObjectId(objectId);
        object.setType("RECTANGLE");
        object.setX(x);
        object.setY(y);
        object.setWidth(width);
        object.setHeight(height);
        object.setRotation(0);
        object.setColor("#ffffff");
        object.setStrokeColor("#000000");
        object.setStrokeWidth(2);
        object.setText(null);
        return object;
    }
}
