package com.collaborative_canvas.service;

import com.collaborative_canvas.repository.CanvasOperationHistoryRepository;
import com.collaborative_canvas.websocket.CanvasOperationEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;

/**
 * Consumes the durable operation log and persists each entry to {@code canvas_operations}.
 *
 * <p>Kafka is at-least-once, so delivery may repeat. Idempotency is enforced in the
 * repository via {@code ON CONFLICT (operation_id) DO NOTHING} rather than here, so a
 * redelivered operation is silently ignored.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CanvasOperationHistoryConsumer {

    private final CanvasOperationHistoryRepository repository;

    private final ObjectMapper objectMapper;

    @Transactional
    @KafkaListener(topics = CanvasOperationProducer.TOPIC)
    public void onOperation(CanvasOperationEvent event) {
        if (event == null || event.operationId() == null) {
            log.warn("Ignoring malformed canvas operation event: {}", event);
            return;
        }

        String payloadJson = event.payload() == null
                ? null
                : objectMapper.writeValueAsString(event.payload());

        repository.insertIfAbsent(
                event.operationId(),
                event.canvasId(),
                event.clientId(),
                event.sequence(),
                event.type(),
                payloadJson,
                Timestamp.from(event.createdAt())
        );
    }
}
