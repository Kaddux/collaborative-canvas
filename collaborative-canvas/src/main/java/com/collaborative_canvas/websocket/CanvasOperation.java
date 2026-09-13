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
    private String objectType = "RECTANGLE";
    private double width = 200;
    private double height = 100;
    private double rotation;
    private String color = "#ffffff";
    private String strokeColor = "#000000";
    private double strokeWidth = 2;
    private String text;
    private String operationId;
    private long sequence;

}
