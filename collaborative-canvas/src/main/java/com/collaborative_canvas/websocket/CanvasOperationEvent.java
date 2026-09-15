package com.collaborative_canvas.websocket;

import java.time.Instant;

/**
 * Kafka value for the durable {@code canvas-operations} log.
 *
 * <p>This wraps {@link CanvasOperation} rather than extending or modifying it, because the
 * WebSocket operation payload carries neither {@code canvasId} nor {@code clientId}, and the
 * wire format must stay unchanged. The Kafka record key is the {@code canvasId}, so all
 * operations for a given canvas land on the same partition and therefore preserve the
 * per-canvas sequence order.
 */
public record CanvasOperationEvent(
        String operationId,
        String canvasId,
        String clientId,
        long sequence,
        String type,
        CanvasOperation payload,
        Instant createdAt
) {
}
