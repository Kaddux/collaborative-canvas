package com.collaborative_canvas.websocket;

import lombok.Getter;
import lombok.Setter;



@Getter
@Setter
public class CanvasMessage {

    private String type;
    private Object payload;
    private String clientId;
    private Object metadata;
    private long sequence;
    private String canvasId;
}
