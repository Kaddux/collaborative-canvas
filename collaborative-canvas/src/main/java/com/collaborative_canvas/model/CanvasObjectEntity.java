package com.collaborative_canvas.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "canvas_objects")
@Getter
@Setter
public class CanvasObjectEntity {

    @Id
    private String objectId;

    private String canvasId;

    private double x;

    private double y;

    private String type;

    private double width;

    private double height;

    private double rotation;

    private String color;

    private String strokeColor;

    private double strokeWidth;

    private String text;

    protected CanvasObjectEntity() {
    }

    public CanvasObjectEntity(
            String objectId,
            String canvasId,
            double x,
            double y) {

        this(objectId, canvasId, "RECTANGLE", x, y, 200, 100, 0,
                "#ffffff", "#1E1E1E", 2, null);
    }

    public CanvasObjectEntity(
            String objectId,
            String canvasId,
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

        this.objectId = objectId;
        this.canvasId = canvasId;
        this.type = type;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.rotation = rotation;
        this.color = color;
        this.strokeColor = strokeColor;
        this.strokeWidth = strokeWidth;
        this.text = text;
    }
}
