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
}
