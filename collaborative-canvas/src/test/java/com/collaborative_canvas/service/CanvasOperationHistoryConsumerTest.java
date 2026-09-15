package com.collaborative_canvas.service;

import com.collaborative_canvas.repository.CanvasOperationHistoryRepository;
import com.collaborative_canvas.websocket.CanvasOperation;
import com.collaborative_canvas.websocket.CanvasOperationEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Instant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class CanvasOperationHistoryConsumerTest {

    private CanvasOperationHistoryRepository repository;
    private ObjectMapper objectMapper;
    private CanvasOperationHistoryConsumer consumer;

    @BeforeEach
    void setUp() {
        repository = mock(CanvasOperationHistoryRepository.class);
        objectMapper = mock(ObjectMapper.class);
        consumer = new CanvasOperationHistoryConsumer(repository, objectMapper);
        when(objectMapper.writeValueAsString(any())).thenReturn("{\"type\":\"CREATE_OBJECT\"}");
    }

    @Test
    void onOperationPersistsSerializedPayload() {
        Instant createdAt = Instant.parse("2026-01-01T00:00:00Z");
        CanvasOperationEvent event = new CanvasOperationEvent(
                "op-1", "canvas-1", "client-1", 7L,
                "CREATE_OBJECT", new CanvasOperation(), createdAt
        );

        consumer.onOperation(event);

        verify(repository).insertIfAbsent(
                eq("op-1"),
                eq("canvas-1"),
                eq("client-1"),
                eq(7L),
                eq("CREATE_OBJECT"),
                eq("{\"type\":\"CREATE_OBJECT\"}"),
                eq(Timestamp.from(createdAt))
        );
    }

    @Test
    void redeliveryDelegatesToIdempotentUpsert() {
        CanvasOperationEvent event = new CanvasOperationEvent(
                "op-1", "canvas-1", "client-1", 7L,
                "CREATE_OBJECT", new CanvasOperation(), Instant.parse("2026-01-01T00:00:00Z")
        );

        consumer.onOperation(event);
        consumer.onOperation(event);

        verify(repository, times(2)).insertIfAbsent(
                eq("op-1"), eq("canvas-1"), eq("client-1"), eq(7L),
                eq("CREATE_OBJECT"), eq("{\"type\":\"CREATE_OBJECT\"}"),
                eq(Timestamp.from(Instant.parse("2026-01-01T00:00:00Z")))
        );
    }

    @Test
    void malformedEventIsIgnored() {
        consumer.onOperation(new CanvasOperationEvent(
                null, "canvas-1", "client-1", 7L,
                "CREATE_OBJECT", new CanvasOperation(), Instant.now()
        ));

        verifyNoInteractions(repository);
    }
}
