package com.collaborative_canvas.service;

import com.collaborative_canvas.canvas.CanvasResponse;
import com.collaborative_canvas.model.CanvasObjectEntity;
import com.collaborative_canvas.persistence.CanvasEntity;
import com.collaborative_canvas.persistence.CanvasMetadataRepository;
import com.collaborative_canvas.repository.CanvasRepository;
import com.collaborative_canvas.websocket.CanvasObject;
import com.collaborative_canvas.websocket.CanvasOperation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CanvasServiceTest {

    private CanvasRepository canvasRepository;
    private CanvasMetadataRepository canvasMetadataRepository;
    private CanvasService canvasService;

    @BeforeEach
    void setUp() {
        canvasRepository = mock(CanvasRepository.class);
        canvasMetadataRepository = mock(CanvasMetadataRepository.class);
        canvasService = new CanvasService(canvasRepository, canvasMetadataRepository);
    }

    @Test
    void createObjectPersistsObjectAndCanLoadIt() {
        CanvasService.OperationResult result = canvasService.createObject(
                "canvas-1", "object-1", 10.5, 20.25
        );

        assertTrue(result.success());
        assertNull(result.error());
        CanvasObject object = canvasService.getObject("canvas-1", "object-1");
        assertNotNull(object);
        assertEquals(10.5, object.getX());
        assertEquals(20.25, object.getY());
        verify(canvasRepository).save(any(CanvasObjectEntity.class));
    }

    @Test
    void duplicateObjectIsRejected() {
        canvasService.createObject("canvas-1", "object-1", 1, 2);

        CanvasService.OperationResult result = canvasService.createObject(
                "canvas-1", "object-1", 3, 4
        );

        assertFalse(result.success());
        assertEquals("Object already exists", result.error());
    }

        @Test
        void richObjectFieldsAreStoredInMemoryAndPersistence() {
        CanvasService.OperationResult result = canvasService.createObject(
            "canvas-1", "object-1", "ELLIPSE", 10, 20,
            80, 40, 15, "#ffffff", "#111111", 3, "label"
        );

        assertTrue(result.success());
        CanvasObject object = canvasService.getObject("canvas-1", "object-1");
        assertEquals("ELLIPSE", object.getType());
        assertEquals(80, object.getWidth());
        assertEquals(40, object.getHeight());
        assertEquals("label", object.getText());
        verify(canvasRepository).save(argThat(entity ->
            "ELLIPSE".equals(entity.getType())
                && entity.getWidth() == 80
                && entity.getHeight() == 40
                && "label".equals(entity.getText())
        ));
        }

    @Test
    void moveObjectUpdatesCoordinatesAndPersistence() {
        canvasService.createObject("canvas-1", "object-1", 1, 2);

        CanvasService.OperationResult result = canvasService.moveObject(
                "canvas-1", "object-1", 30, 40
        );

        assertTrue(result.success());
        CanvasObject object = canvasService.getObject("canvas-1", "object-1");
        assertEquals(30, object.getX());
        assertEquals(40, object.getY());
        verify(canvasRepository).save(any(CanvasObjectEntity.class));
    }

    @Test
    void missingObjectCannotBeMovedOrDeleted() {
        CanvasService.OperationResult moveResult = canvasService.moveObject(
                "canvas-1", "missing", 1, 2
        );
        CanvasService.OperationResult deleteResult = canvasService.deleteObject(
                "canvas-1", "missing"
        );

        assertFalse(moveResult.success());
        assertEquals("Object does not exist", moveResult.error());
        assertFalse(deleteResult.success());
        assertEquals("Object does not exist", deleteResult.error());
        verify(canvasRepository, never()).deleteById("missing");
    }

    @Test
    void createAndGetCanvasUseMetadataRepository() {
        Instant timestamp = Instant.parse("2026-01-01T00:00:00Z");
        CanvasEntity entity = new CanvasEntity(
                "canvas-1", "Sprint board", timestamp, timestamp
        );
        when(canvasMetadataRepository.findById("canvas-1"))
                .thenReturn(Optional.of(entity));

        CanvasResponse created = canvasService.createCanvas("Sprint board");
        CanvasResponse found = canvasService.getCanvas("canvas-1");

        assertNotNull(created.canvasId());
        assertEquals("Sprint board", created.name());
        assertEquals("canvas-1", found.canvasId());
        assertEquals("Sprint board", found.name());
        verify(canvasMetadataRepository).save(any(CanvasEntity.class));
    }

    @Test
    void updateObjectChangesStyleFieldsAndPersists() {
        canvasService.createObject("canvas-1", "object-1", "RECTANGLE", 10, 20,
                200, 100, 0, "#ffffff", "#000000", 2, null);

        CanvasObjectEntity existingEntity = new CanvasObjectEntity(
                "object-1", "canvas-1", "RECTANGLE", 10, 20,
                200, 100, 0, "#ffffff", "#000000", 2, null);
        when(canvasRepository.findById("object-1"))
                .thenReturn(Optional.of(existingEntity));

        // object.setX(op.getX());
        //            object.setY(op.getY());
        //            object.setWidth(width);
        //            object.setHeight(height);
        //            object.setRotation(op.getRotation());
        //            object.setColor(op.getColor());
        //            object.setStrokeColor(op.getStrokeColor());
        //            object.setStrokeWidth(strokeWidth);
        //            object.setText(op.getText());
        CanvasService.OperationResult result = canvasService.updateObject(
                "canvas-1", updateOperation("object-1", 10, 20, 300,
                        150, 45, "#ff0000", "#00ff00", 4, "hello")
        );

        assertTrue(result.success());
        CanvasObject object = canvasService.getObject("canvas-1", "object-1");
        assertEquals(300, object.getWidth());
        assertEquals(150, object.getHeight());
        assertEquals(45, object.getRotation());
        assertEquals("#ff0000", object.getColor());
        assertEquals("#00ff00", object.getStrokeColor());
        assertEquals(4, object.getStrokeWidth());
        assertEquals("hello", object.getText());
        verify(canvasRepository).save(argThat(entity ->
                entity.getWidth() == 300
                        && entity.getHeight() == 150
                        && entity.getRotation() == 45
                        && "#ff0000".equals(entity.getColor())
                        && "#00ff00".equals(entity.getStrokeColor())
                        && entity.getStrokeWidth() == 4
                        && "hello".equals(entity.getText())
        ));
    }

    @Test
    void resizeObjectUpdatesBoundsAndClampsDimensions() {
        canvasService.createObject("canvas-1", "object-1", "RECTANGLE", 10, 20,
                200, 100, 0, "#ffffff", "#000000", 2, null);
        when(canvasRepository.findById("object-1"))
                .thenReturn(Optional.of(new CanvasObjectEntity(
                        "object-1", "canvas-1", "RECTANGLE", 10, 20,
                        200, 100, 0, "#ffffff", "#000000", 2, null)));

        CanvasService.OperationResult result = canvasService.updateObject(
                "canvas-1", updateOperation("object-1", 75, 90, 0,
                        0, 0, "#ffffff", "#000000", 2, null)
        );

        assertTrue(result.success());
        CanvasObject object = canvasService.getObject("canvas-1", "object-1");
        assertEquals(75, object.getX());
        assertEquals(90, object.getY());
        assertEquals(4, object.getWidth());
        assertEquals(4, object.getHeight());
        verify(canvasRepository).save(argThat(entity ->
                entity.getX() == 75
                        && entity.getY() == 90
                        && entity.getWidth() == 4
                        && entity.getHeight() == 4
        ));
    }

    @Test
    void resizeOfMissingObjectIsRejectedWithoutPersistence() {
        CanvasService.OperationResult result = canvasService.updateObject(
                "canvas-1", updateOperation("missing", 75, 90, 120,
                        80, 0, "#ffffff", "#000000", 2, null)
        );

        assertFalse(result.success());
        assertEquals("Object not found: missing", result.error());
        verify(canvasRepository, never()).save(any(CanvasObjectEntity.class));
    }

    @Test
    void updateNonexistentObjectFails() {
        CanvasService.OperationResult result = canvasService.updateObject(
                                "canvas-1", updateOperation("missing", 0, 0, 200,
                                        100, 0, "#ffffff", "#000000", 2, null)
        );

        assertFalse(result.success());
                assertEquals("Object not found: missing", result.error());
    }

    @Test
    void updateObjectPreservesObjectType() {
        canvasService.createObject("canvas-1", "object-1", "ELLIPSE", 10, 20,
                200, 100, 0, "#ffffff", "#000000", 2, null);
        when(canvasRepository.findById("object-1"))
                .thenReturn(Optional.of(new CanvasObjectEntity(
                        "object-1", "canvas-1", "ELLIPSE", 10, 20,
                        200, 100, 0, "#ffffff", "#000000", 2, null)));

        canvasService.updateObject("canvas-1",
                updateOperation("object-1", 10, 20, 300, 150, 0, "#ff0000", "#000000", 2, null));

        assertEquals("ELLIPSE", canvasService.getObject("canvas-1", "object-1").getType());
    }

    @Test
    void operationResultCarriesBeforeAndAfterSnapshots() {
        canvasService.createObject("canvas-1", "object-1", 10, 20);

        CanvasService.OperationResult move = canvasService.moveObject(
                "canvas-1", "object-1", 50, 60);

        assertTrue(move.success());
        assertEquals(10, move.before().getX());
        assertEquals(20, move.before().getY());
        assertEquals(50, move.after().getX());
        assertEquals(60, move.after().getY());

        CanvasService.OperationResult delete = canvasService.deleteObject(
                "canvas-1", "object-1");

        assertTrue(delete.success());
        assertNotNull(delete.before());
        assertNull(delete.after());
        assertEquals("object-1", delete.before().getObjectId());
    }

        private CanvasOperation updateOperation(
                        String objectId,
                        double x,
                        double y,
                        double width,
                            double height,
                            double rotation,
                        String color,
                        String strokeColor,
                        double strokeWidth,
                        String text
        ) {
                CanvasOperation operation = new CanvasOperation();
                operation.setObjectId(objectId);
                operation.setType("RECTANGLE");
                operation.setX(x);
                operation.setY(y);
                operation.setWidth(width);
                operation.setHeight(height);
                operation.setRotation(rotation);
                operation.setColor(color);
                operation.setStrokeColor(strokeColor);
                operation.setStrokeWidth(strokeWidth);
                operation.setText(text);
                return operation;
        }
}
