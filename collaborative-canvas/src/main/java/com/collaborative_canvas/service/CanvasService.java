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
                                200, 100, 0, "#ffffff", "#000000", 2, null);
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

                if (objectId == null || objectId.isBlank()) {
                        return new OperationResult(false, "Object ID is required");
                }
                if (type == null) {
                        return new OperationResult(false, "Object type is required");
                }
                try {
                        CanvasObjectType.valueOf(type);
                } catch (IllegalArgumentException exception) {
                        return new OperationResult(false, "Invalid object type");
                }
                if (width < 0 || height < 0) {
                        return new OperationResult(false, "Width and height cannot be negative");
                }
                if (strokeWidth < 0) {
                        return new OperationResult(false, "strokeWidth cannot be negative");
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

        CanvasObject existing =
                objects.putIfAbsent(objectId, object);

        if (existing != null) {
            return new OperationResult(
                    false,
                    "Object already exists"
            );
        }

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
                        text
                )
        );

        return new OperationResult(true, null);
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
            return new OperationResult(false, "Object does not exist");
        }

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

            canvasRepository.save(entity);
        }

        return new OperationResult(true, null);
    }

        @Transactional
        public OperationResult deleteObject(
            String canvasId,
            String objectId) {

        Map<String, CanvasObject> objects = canvasObjects.get(canvasId);

        if (objects == null || objects.remove(objectId) == null) {

            return new OperationResult(false, "Object does not exist");
        }

        canvasRepository.deleteById(objectId);

        return new OperationResult(true, null);
    }

    @Transactional
    public OperationResult updateObject(String canvasId, CanvasOperation op) {

        if (op.getObjectId() == null || op.getObjectId().isBlank()) {
            return new OperationResult(false, "objectId is required");
        }

        Map<String, CanvasObject> room = canvasObjects.get(canvasId);
        if (room == null || !room.containsKey(op.getObjectId())) {
            return new OperationResult(false,"Object not found: " + op.getObjectId());
        }

        // server-side clamping
        double width = Math.max(4, op.getWidth());
        double height = Math.max(4, op.getHeight());
        double strokeWidth = Math.max(0, op.getStrokeWidth());

        CanvasObject object = room.get(op.getObjectId());

        synchronized (object) {
            object.setType(op.getType());
            object.setX(op.getX());
            object.setY(op.getY());
            object.setWidth(width);
            object.setHeight(height);
            object.setRotation(op.getRotation());
            object.setColor(op.getColor());
            object.setStrokeColor(op.getStrokeColor());
            object.setStrokeWidth(strokeWidth);
            object.setText(op.getText());
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
            canvasRepository.save(entity);
        });

        return new OperationResult(true,null);
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


    public record OperationResult(
            boolean success,
            String error
    ) {}
}
