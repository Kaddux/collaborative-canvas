package com.collaborative_canvas.canvas;

import com.collaborative_canvas.service.CanvasService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/canvases")
public class CanvasController {

    private final CanvasService canvasService;

    public CanvasController(CanvasService canvasService) {
        this.canvasService = canvasService;
    }

    @PostMapping
    public ResponseEntity<CanvasResponse> createCanvas(
            @RequestBody CreateCanvasRequest request) {

        CanvasResponse response =
                canvasService.createCanvas(request.name());

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    @GetMapping("/{canvasId}")
    public ResponseEntity<CanvasResponse> getCanvas(
            @PathVariable String canvasId) {

        CanvasResponse response =
                canvasService.getCanvas(canvasId);

        if (response == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(response);
    }
}
