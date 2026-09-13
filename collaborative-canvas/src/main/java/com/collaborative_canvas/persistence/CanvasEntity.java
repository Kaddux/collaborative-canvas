package com.collaborative_canvas.persistence;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "canvases")
@Getter
@Setter
public class CanvasEntity {

    @Id
    private String canvasId;

    private String name;

    private Instant createdAt;

    private Instant updatedAt;

    protected CanvasEntity() {
    }

    public CanvasEntity(
            String canvasId,
            String name,
            Instant createdAt,
            Instant updatedAt) {

        this.canvasId = canvasId;
        this.name = name;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

}
