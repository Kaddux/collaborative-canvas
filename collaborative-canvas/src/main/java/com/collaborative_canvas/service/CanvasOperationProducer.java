package com.collaborative_canvas.service;

import com.collaborative_canvas.websocket.CanvasOperation;
import com.collaborative_canvas.websocket.CanvasOperationEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;

@Slf4j
@Component
public class CanvasOperationProducer {

    public static final String TOPIC = "canvas-operations";

    private final KafkaTemplate<String, CanvasOperationEvent> kafkaTemplate;

    private final Executor publisherExecutor;

    public CanvasOperationProducer(
            KafkaTemplate<String, CanvasOperationEvent> kafkaTemplate,
            @Qualifier("canvasOperationPublisherExecutor") Executor publisherExecutor) {
        this.kafkaTemplate = kafkaTemplate;
        this.publisherExecutor = publisherExecutor;
    }

    /**
     * Publishes a successfully applied operation to the durable {@code canvas-operations} log.
     *
     * <p><strong>Scope boundary:</strong> this is audit/history infrastructure, not full event
     * sourcing. The {@code canvas_objects} table remains the source of truth for {@code
     * SYNC_STATE}; the canvas is never rebuilt from this log. Kafka's only job is to durably
     * capture the ordered sequence of operations for future replay/audit.
     *
     * <p><strong>Fire-and-forget:</strong> the send runs on a dedicated executor and is never
     * awaited, so a slow or unreachable broker cannot block the WebSocket handler. Failures are
     * logged as warnings and swallowed. The deliberate tradeoff is that operations occurring
     * while Kafka is unavailable are absent from the log.
     *
     * @param canvasId  the canvas the operation belongs to; also used as the Kafka record key
     * @param clientId  the originating client, may be {@code null}
     * @param operation the operation that was just applied to memory and persisted
     */
    public void publish(String canvasId, String clientId, CanvasOperation operation) {
        if (operation == null) {
            return;
        }

        CanvasOperationEvent event = new CanvasOperationEvent(
                operation.getOperationId(),
                canvasId,
                clientId,
                operation.getSequence(),
                operation.getType(),
                operation,
                Instant.now()
        );

        try {
            publisherExecutor.execute(() -> send(canvasId, operation, event));
        } catch (RejectedExecutionException exception) {
            log.warn(
                    "Publisher rejected operation {} for canvas {}; canvas state is unaffected",
                    operation.getOperationId(),
                    canvasId,
                    exception
            );
        }
    }

    private void send(
            String canvasId,
            CanvasOperation operation,
            CanvasOperationEvent event) {
        try {
            kafkaTemplate.send(TOPIC, canvasId, event)
                    .whenComplete((result, throwable) -> {
                        if (throwable != null) {
                            log.warn(
                                    "Failed to publish operation {} for canvas {} to Kafka; "
                                            + "canvas state is unaffected",
                                    operation.getOperationId(),
                                    canvasId,
                                    throwable
                            );
                        }
                    });
        } catch (Exception exception) {
            // send() can throw synchronously (e.g. metadata timeout, serialization errors).
            log.warn(
                    "Failed to publish operation {} for canvas {} to Kafka; "
                            + "canvas state is unaffected",
                    operation.getOperationId(),
                    canvasId,
                    exception
            );
        }
    }
}
