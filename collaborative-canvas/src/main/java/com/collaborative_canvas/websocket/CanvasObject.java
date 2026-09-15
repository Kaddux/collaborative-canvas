package com.collaborative_canvas.websocket;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CanvasObject {

    private String objectId;
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
    private String textColor;
    private double fontSize;

    /** Defensive snapshot used to capture before/after states for undo/redo history. */
    public CanvasObject copy() {
        CanvasObject copy = new CanvasObject();
        copy.objectId = objectId;
        copy.x = x;
        copy.y = y;
        copy.type = type;
        copy.width = width;
        copy.height = height;
        copy.rotation = rotation;
        copy.color = color;
        copy.strokeColor = strokeColor;
        copy.strokeWidth = strokeWidth;
        copy.text = text;
        copy.textColor = textColor;
        copy.fontSize = fontSize;
        return copy;
    }
}
