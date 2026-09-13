package com.collaborative_canvas.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CanvasMetadataRepository
        extends JpaRepository<CanvasEntity, String> {
}
