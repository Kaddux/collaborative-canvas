package com.collaborative_canvas.repository;

import com.collaborative_canvas.model.CanvasOperationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;

@Repository
public interface CanvasOperationHistoryRepository
        extends JpaRepository<CanvasOperationEntity, String> {

    /**
     * Idempotently inserts one history row. Kafka delivers at least once, so the same
     * operation may be consumed more than once; {@code ON CONFLICT (operation_id) DO NOTHING}
     * makes redelivery a no-op, mirroring the defensive {@code putIfAbsent} used when creating
     * objects.
     *
     * <p>Uses a native query because JPA {@code save()} cannot express {@code ON CONFLICT}.
     * The payload is passed as an already-serialized JSON string and cast explicitly, since
     * native queries bypass the entity's {@code jsonb} type mapping.
     */
    @Modifying
    @Query(value = """
            INSERT INTO canvas_operations
                (operation_id, canvas_id, client_id, sequence, type, payload, created_at)
            VALUES
                (:operationId, :canvasId, :clientId, :sequence, :type,
                 CAST(:payload AS jsonb), :createdAt)
            ON CONFLICT (operation_id) DO NOTHING
            """, nativeQuery = true)
    void insertIfAbsent(
            @Param("operationId") String operationId,
            @Param("canvasId") String canvasId,
            @Param("clientId") String clientId,
            @Param("sequence") long sequence,
            @Param("type") String type,
            @Param("payload") String payload,
            @Param("createdAt") Timestamp createdAt
    );
}
