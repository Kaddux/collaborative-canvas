package com.collaborative_canvas.canvas;

import java.time.Instant;

public record CanvasResponse(
        String canvasId,
        String name,
        Instant createdAt,
        Instant updatedAt
) {
}
