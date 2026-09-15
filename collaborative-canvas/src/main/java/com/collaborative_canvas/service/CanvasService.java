package com.collaborative_canvas.service;

import com.collaborative_canvas.canvas.CanvasResponse;
import com.collaborative_canvas.model.CanvasObjectEntity;
import com.collaborative_canvas.persistence.CanvasEntity;
import com.collaborative_canvas.persistence.CanvasMetadataRepository;
import com.collaborative_canvas.repository.CanvasRepository;
import com.collaborative_canvas.websocket.CanvasObject;
import com.collaborative_canvas.websocket.CanvasObjectType;
import com.collaborative_canvas.websocket.CanvasOperation;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class CanvasService {

    private final CanvasRepository canvasRepository;

    private final CanvasMetadataRepository canvasMetadataRepository;

    private final Map<String, Map<String, CanvasObject>> canvasObjects =
            new ConcurrentHashMap<>();

        @Transactional
        public OperationResult createObject(
            String canvasId,
            String objectId,
            double x,
            double y) {

                return createObject(canvasId, objectId, "RECTANGLE", x, y,
                                200, 100, 0, "#ffffff", "#1E1E1E", 2, null, null, 16);
        }

        @Transactional
        public OperationResult createObject(
                        String canvasId,
                        String objectId,
                        String type,
                        double x,
                        double y,
                        double width,
                        double height,
                        double rotation,
                        String color,
                        String strokeColor,
                        double strokeWidth,
                        String text) {

                return createObject(canvasId, objectId, type, x, y, width, height,
                        rotation, color, strokeColor, strokeWidth, text, null, 16);
        }

        @Transactional
        public OperationResult createObject(
                        String canvasId,
                        String objectId,
                        String type,
                        double x,
                        double y,
                        double width,
                        double height,
                        double rotation,
                        String color,
                        String strokeColor,
                        double strokeWidth,
                        String text,
                        String textColor,
                        double fontSize) {

                if (objectId == null || objectId.isBlank()) {
                        return OperationResult.failure("Object ID is required");
                }
                if (type == null) {
                        return OperationResult.failure("Object type is required");
                }
                try {
                        CanvasObjectType.valueOf(type);
                } catch (IllegalArgumentException exception) {
                        return OperationResult.failure("Invalid object type");
                }
                if (width < 0 || height < 0) {
                        return OperationResult.failure("Width and height cannot be negative");
                }
                if (strokeWidth < 0) {
                        return OperationResult.failure("strokeWidth cannot be negative");
                }

        Map<String, CanvasObject> objects =
                canvasObjects.computeIfAbsent(
                        canvasId,
                        id -> new ConcurrentHashMap<>()
                );

        CanvasObject object = new CanvasObject();

        object.setObjectId(objectId);
        object.setType(type);
        object.setX(x);
        object.setY(y);
        object.setWidth(width);
        object.setHeight(height);
        object.setRotation(rotation);
        object.setColor(color);
        object.setStrokeColor(strokeColor);
        object.setStrokeWidth(strokeWidth);
        object.setText(text);
        object.setTextColor(textColor);
        object.setFontSize(fontSize);

        CanvasObject existing =
                objects.putIfAbsent(objectId, object);

        if (existing != null) {
            return OperationResult.failure("Object already exists");
        }

        try {
            canvasRepository.save(
                    new CanvasObjectEntity(
                            objectId,
                            canvasId,
                            type,
                            x,
                            y,
                            width,
                            height,
                            rotation,
                            color,
                            strokeColor,
                            strokeWidth,
                            text,
                            textColor,
                            fontSize
                    )
            );
        } catch (RuntimeException exception) {
            // Keep the in-memory cache consistent with the rolled-back DB write.
            objects.remove(objectId, object);
            throw exception;
        }

        return OperationResult.applied(null, object.copy());
    }

    public CanvasObject getObject(
            String canvasId,
            String objectId) {

        Map<String, CanvasObject> objects = canvasObjects.get(canvasId);

        if (objects == null) {
            return null;
        }

        return objects.get(objectId);
    }

    public Collection<CanvasObject> getObjects(
            String canvasId) {

        Map<String, CanvasObject> objects = canvasObjects.get(canvasId);

        if (objects == null) {
            return java.util.List.of();
        }

        return objects.values();
    }

        @Transactional
        public OperationResult moveObject(
            String canvasId,
            String objectId,
            double x,
            double y) {

        CanvasObject object =
                getObject(canvasId, objectId);
        if (object == null) {
            return OperationResult.failure("Object does not exist");
        }

        CanvasObject before = object.copy();

        synchronized (object) {
            object.setX(x);
            object.setY(y);
        }

        CanvasObjectEntity entity =
                canvasRepository.findById(objectId)
                        .orElse(null);

        if (entity != null) {
            entity.setX(x);
            entity.setY(y);

            try {
                canvasRepository.save(entity);
            } catch (RuntimeException exception) {
                restore(object, before);
                throw exception;
            }
        }

        return OperationResult.applied(before, object.copy());
    }

        @Transactional
        public OperationResult deleteObject(
            String canvasId,
            String objectId) {

        Map<String, CanvasObject> objects = canvasObjects.get(canvasId);

        if (objects == null) {
            return OperationResult.failure("Object does not exist");
        }

        CanvasObject removed = objects.remove(objectId);

        if (removed == null) {
            return OperationResult.failure("Object does not exist");
        }

        canvasRepository.deleteById(objectId);

        return OperationResult.applied(removed, null);
    }

    @Transactional
    public OperationResult updateObject(String canvasId, CanvasOperation op) {

        if (op.getObjectId() == null || op.getObjectId().isBlank()) {
            return OperationResult.failure("objectId is required");
        }

        Map<String, CanvasObject> room = canvasObjects.get(canvasId);
        if (room == null || !room.containsKey(op.getObjectId())) {
            return OperationResult.failure("Object not found: " + op.getObjectId());
        }

        // server-side clamping
        double width = Math.max(4, op.getWidth());
        double height = Math.max(4, op.getHeight());
        double strokeWidth = Math.max(0, op.getStrokeWidth());

        CanvasObject object = room.get(op.getObjectId());

        CanvasObject before = object.copy();

        try {
            synchronized (object) {
                // The object type is identity, not a mutable style field: UPDATE_OBJECT never
                // changes it. (The operation type is not the object type.)
                object.setX(op.getX());
                object.setY(op.getY());
                object.setWidth(width);
                object.setHeight(height);
                object.setRotation(op.getRotation());
                object.setColor(op.getColor());
                object.setStrokeColor(op.getStrokeColor());
                object.setStrokeWidth(strokeWidth);
                object.setText(op.getText());
                object.setTextColor(op.getTextColor());
                object.setFontSize(op.getFontSize());
            }

            canvasRepository.findById(op.getObjectId()).ifPresent(entity -> {
                entity.setX(op.getX());
                entity.setY(op.getY());
                entity.setWidth(width);
                entity.setHeight(height);
                entity.setRotation(op.getRotation());
                entity.setColor(op.getColor());
                entity.setStrokeColor(op.getStrokeColor());
                entity.setStrokeWidth(strokeWidth);
                entity.setText(op.getText());
                entity.setTextColor(op.getTextColor());
                entity.setFontSize(op.getFontSize());
                canvasRepository.save(entity);
            });
        } catch (RuntimeException exception) {
            // Keep the in-memory cache consistent with the rolled-back DB write.
            restore(object, before);
            throw exception;
        }

        return OperationResult.applied(before, object.copy());
    }

    public Collection<CanvasObject> loadObjects(String canvasId) {

        Map<String, CanvasObject> objects =
                canvasObjects.computeIfAbsent(
                        canvasId,
                        id -> new ConcurrentHashMap<>()
                );

        if (objects.isEmpty()) {
            List<CanvasObjectEntity> entities =
                    canvasRepository.findByCanvasId(canvasId);

            for (CanvasObjectEntity entity : entities) {

                CanvasObject object = new CanvasObject();

                object.setObjectId(entity.getObjectId());
                object.setType(entity.getType());
                object.setX(entity.getX());
                object.setY(entity.getY());
                object.setWidth(entity.getWidth());
                object.setHeight(entity.getHeight());
                object.setRotation(entity.getRotation());
                object.setColor(entity.getColor());
                object.setStrokeColor(entity.getStrokeColor());
                object.setStrokeWidth(entity.getStrokeWidth());
                object.setText(entity.getText());
                object.setTextColor(entity.getTextColor());
                object.setFontSize(entity.getFontSize());

                objects.put(
                        entity.getObjectId(),
                        object
                );
            }
        }

        return objects.values();
    }

    public CanvasResponse createCanvas(String name) {

        String canvasId = UUID.randomUUID().toString();

        Instant now = Instant.now();

        CanvasEntity entity =
                new CanvasEntity(
                        canvasId,
                        name,
                        now,
                        now
                );

        canvasMetadataRepository.save(entity);

        return new CanvasResponse(
                entity.getCanvasId(),
                entity.getName(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    public CanvasResponse getCanvas(String canvasId) {

        CanvasEntity entity =
                canvasMetadataRepository.findById(canvasId)
                        .orElse(null);

        if (entity == null) {
            return null;
        }

        return new CanvasResponse(
                entity.getCanvasId(),
                entity.getName(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    public boolean canvasExists(String canvasId) {
        return canvasMetadataRepository.existsById(canvasId);
    }

    /** Restores an in-memory object to a prior snapshot after a failed persistence write. */
    private static void restore(CanvasObject target, CanvasObject source) {
        synchronized (target) {
            target.setX(source.getX());
            target.setY(source.getY());
            target.setWidth(source.getWidth());
            target.setHeight(source.getHeight());
            target.setRotation(source.getRotation());
            target.setColor(source.getColor());
            target.setStrokeColor(source.getStrokeColor());
            target.setStrokeWidth(source.getStrokeWidth());
            target.setText(source.getText());
            target.setTextColor(source.getTextColor());
            target.setFontSize(source.getFontSize());
        }
    }

    public record OperationResult(
            boolean success,
            String error,
            CanvasObject before,
            CanvasObject after
    ) {
        public static OperationResult failure(String error) {
            return new OperationResult(false, error, null, null);
        }

        public static OperationResult applied(CanvasObject before, CanvasObject after) {
            return new OperationResult(true, null, before, after);
        }
    }
}
