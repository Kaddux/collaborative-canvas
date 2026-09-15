package com.collaborative_canvas.websocket;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CanvasOperation {

    private String type;
    private String objectId;
    private double x;
    private double y;
    private String objectType;
    private double width;
    private double height;
    private double rotation;
    private String color;
    private String strokeColor;
    private double strokeWidth;
    private String text;
    private String textColor;
    private double fontSize;
    private String operationId;
    private long sequence;

}
