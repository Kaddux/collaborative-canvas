package com.collaborative_canvas.repository;

import com.collaborative_canvas.model.CanvasObjectEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CanvasRepository extends JpaRepository<CanvasObjectEntity, String> {

    List<CanvasObjectEntity> findByCanvasId(String canvasId);
}
