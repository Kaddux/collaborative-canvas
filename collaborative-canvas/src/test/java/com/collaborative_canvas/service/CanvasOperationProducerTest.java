package com.collaborative_canvas.service;

import com.collaborative_canvas.websocket.CanvasOperation;
import com.collaborative_canvas.websocket.CanvasOperationEvent;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class CanvasOperationProducerTest {

    @SuppressWarnings("unchecked")
    private final KafkaTemplate<String, CanvasOperationEvent> kafkaTemplate =
            mock(KafkaTemplate.class);

    private final CanvasOperationProducer producer =
            new CanvasOperationProducer(kafkaTemplate, Runnable::run);

    @Test
    void publishSendsEventKeyedByCanvasId() {
        CompletableFuture<SendResult<String, CanvasOperationEvent>> future =
                CompletableFuture.completedFuture(null);
        when(kafkaTemplate.send(anyString(), anyString(), any(CanvasOperationEvent.class)))
                .thenReturn(future);

        CanvasOperation operation = operation();

        producer.publish("canvas-1", "client-1", operation);

        ArgumentCaptor<CanvasOperationEvent> captor =
                ArgumentCaptor.forClass(CanvasOperationEvent.class);
        verify(kafkaTemplate).send(
                eq(CanvasOperationProducer.TOPIC),
                eq("canvas-1"),
                captor.capture()
        );

        CanvasOperationEvent event = captor.getValue();
        assertEquals("op-1", event.operationId());
        assertEquals("canvas-1", event.canvasId());
        assertEquals("client-1", event.clientId());
        assertEquals(7L, event.sequence());
        assertEquals("CREATE_OBJECT", event.type());
        assertEquals(operation, event.payload());
        assertNotNull(event.createdAt());
    }

    @Test
    void publishSwallowsSynchronousSendFailure() {
        when(kafkaTemplate.send(anyString(), anyString(), any(CanvasOperationEvent.class)))
                .thenThrow(new RuntimeException("broker down"));

        assertDoesNotThrow(() -> producer.publish("canvas-1", "client-1", operation()));
    }

    @Test
    void publishIgnoresNullOperation() {
        producer.publish("canvas-1", "client-1", null);

        verifyNoInteractions(kafkaTemplate);
    }

    @Test
    void publishOffloadsSendToExecutorWithoutBlockingCaller() {
        List<Runnable> pending = new ArrayList<>();
        CanvasOperationProducer asyncProducer =
                new CanvasOperationProducer(kafkaTemplate, pending::add);

        asyncProducer.publish("canvas-1", "client-1", operation());

        assertEquals(1, pending.size());
        verifyNoInteractions(kafkaTemplate);

        pending.get(0).run();
        verify(kafkaTemplate).send(anyString(), anyString(), any(CanvasOperationEvent.class));
    }

    private CanvasOperation operation() {
        CanvasOperation operation = new CanvasOperation();
        operation.setType("CREATE_OBJECT");
        operation.setObjectId("object-1");
        operation.setOperationId("op-1");
        operation.setSequence(7L);
        return operation;
    }
}
