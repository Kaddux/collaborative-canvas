package com.collaborative_canvas.model;

import com.collaborative_canvas.websocket.CanvasOperation;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/**
 * Durable history of applied canvas operations, populated from the Kafka
 * {@code canvas-operations} topic. This is a log only — {@code canvas_objects} remains the
 * source of truth for current canvas state.
 *
 * <p>The whole operation payload is stored as {@code jsonb} rather than modelling every
 * field of every operation type as a column.
 */
@Entity
@Table(
        name = "canvas_operations",
        indexes = @Index(
                name = "idx_canvas_operations_canvas_seq",
                columnList = "canvas_id, sequence"
        )
)
@Getter
@Setter
public class CanvasOperationEntity {

    @Id
    @Column(name = "operation_id")
    private String operationId;

    @Column(name = "canvas_id", nullable = false)
    private String canvasId;

    @Column(name = "client_id")
    private String clientId;

    @Column(name = "sequence", nullable = false)
    private long sequence;

    @Column(name = "type", nullable = false)
    private String type;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload")
    private CanvasOperation payload;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected CanvasOperationEntity() {
    }

    public CanvasOperationEntity(
            String operationId,
            String canvasId,
            String clientId,
            long sequence,
            String type,
            CanvasOperation payload,
            Instant createdAt) {

        this.operationId = operationId;
        this.canvasId = canvasId;
        this.clientId = clientId;
        this.sequence = sequence;
        this.type = type;
        this.payload = payload;
        this.createdAt = createdAt;
    }
}
