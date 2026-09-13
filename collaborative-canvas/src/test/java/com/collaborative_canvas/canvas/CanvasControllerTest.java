package com.collaborative_canvas.canvas;

import com.collaborative_canvas.service.CanvasService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CanvasControllerTest {

    private CanvasService canvasService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        canvasService = mock(CanvasService.class);
        mockMvc = MockMvcBuilders
                .standaloneSetup(new CanvasController(canvasService))
                .build();
    }

    @Test
    void createCanvasReturnsCreatedCanvas() throws Exception {
        Instant timestamp = Instant.parse("2026-01-01T00:00:00Z");
        CanvasResponse response = new CanvasResponse(
                "canvas-1",
                "Sprint board",
                timestamp,
                timestamp
        );
        when(canvasService.createCanvas("Sprint board")).thenReturn(response);

        mockMvc.perform(post("/api/canvases")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Sprint board\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.canvasId").value("canvas-1"))
                .andExpect(jsonPath("$.name").value("Sprint board"));
    }

    @Test
    void getCanvasReturnsNotFoundWhenCanvasDoesNotExist() throws Exception {
        when(canvasService.getCanvas("missing")).thenReturn(null);

        mockMvc.perform(get("/api/canvases/missing"))
                .andExpect(status().isNotFound());
    }

    @Test
    void getCanvasReturnsCanvasWhenItExists() throws Exception {
        Instant timestamp = Instant.parse("2026-01-01T00:00:00Z");
        when(canvasService.getCanvas("canvas-1")).thenReturn(new CanvasResponse(
                "canvas-1", "Sprint board", timestamp, timestamp
        ));

        mockMvc.perform(get("/api/canvases/canvas-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canvasId").value("canvas-1"))
                .andExpect(jsonPath("$.name").value("Sprint board"));
    }
}
