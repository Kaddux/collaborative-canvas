package com.collaborative_canvas.config;

import com.collaborative_canvas.websocket.CanvasWebSocketHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final CanvasWebSocketHandler handler;

    private final String[] allowedOrigins;

    public WebSocketConfig(
            CanvasWebSocketHandler handler,
            @Value("${app.websocket.allowed-origins}") String[] allowedOrigins) {
        this.handler = handler;
        this.allowedOrigins = allowedOrigins;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/ws/canvas/{canvasId}")
                .setAllowedOrigins(allowedOrigins);
    }
}
