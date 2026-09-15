package com.collaborative_canvas.websocket;

import com.collaborative_canvas.service.CanvasOperationProducer;
import com.collaborative_canvas.service.CanvasService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Slf4j
@Component
@RequiredArgsConstructor
public class CanvasWebSocketHandler extends TextWebSocketHandler {

    private final CanvasService canvasService;

    private final CanvasOperationProducer canvasOperationProducer;

    private final Map<String, Set<WebSocketSession>> rooms =
            new ConcurrentHashMap<>();
    private final Map<String, String> clientIds =
            new ConcurrentHashMap<>();

    private final Map<String, AtomicLong> canvasSequences =
            new ConcurrentHashMap<>();

    private final Map<String, AtomicLong> lastAppliedSequences =
            new ConcurrentHashMap<>();

    private final Map<String, CanvasHistory> histories =
            new ConcurrentHashMap<>();

    private final ObjectMapper objectMapper;

    @Override
    public void afterConnectionEstablished(
            WebSocketSession session) throws IOException {
        Map<String, Object> metadata = new HashMap<>();

        String canvasId = extractCanvasId(session);

        if (!canvasService.canvasExists(canvasId)) {
            log.warn("Rejecting WebSocket connection for unknown canvas {}", canvasId);
            session.close(new CloseStatus(
                CloseStatus.POLICY_VIOLATION.getCode(),
                "Canvas not found: " + canvasId
            ));
            return;
        }

        log.info("Client {} joined canvas {}", session.getId(), canvasId
        );

        Set<WebSocketSession> clients = rooms.computeIfAbsent(canvasId,
                id -> ConcurrentHashMap.newKeySet()
        );

        clients.add(session);

        Collection<CanvasObject> objects =
                canvasService.loadObjects(canvasId);

        log.info("Objects in canvas {}: {}", canvasId, objects
        );
        String clientId = extractClientId(session);

        if (clientId != null) {
            clientIds.put(session.getId(), clientId);
        }
        broadcastClientJoined(
                canvasId,
                clientId,
                session
        );
        CanvasMessage syncMessage = new CanvasMessage();

        AtomicLong sequence =
                canvasSequences.get(canvasId);

        syncMessage.setType("SYNC_STATE");
        syncMessage.setCanvasId(canvasId);
        syncMessage.setPayload(objects);
        syncMessage.setSequence(
                sequence == null ? 0 : sequence.get()
        );

        metadata.put(
                "clients",
                getConnectedClientIds(canvasId)
        );

        syncMessage.setMetadata(metadata);

        sendMessage(session, new TextMessage(objectMapper.writeValueAsString(syncMessage)));

        sendHistoryState(session, canvasId, clientId);

        int totalClients = rooms.values().stream()
                .mapToInt(Set::size)
                .sum();

        log.info(
                "Client {} connected with clientId {}",
                session.getId(),
                clientId
        );

        log.info("Clients in this canvas: {}", clients.size()
        );

        log.info("Active rooms: {}", rooms.size()
        );

        log.info("Total active clients: {}", totalClients
        );
    }

    @Override
    protected void handleTextMessage(
            WebSocketSession session,
            TextMessage message) throws IOException {

        CanvasOperation operation;

        try {operation = objectMapper.readValue(message.getPayload(), CanvasOperation.class);
        }
        catch (Exception e) {
            sendError(session, "Invalid operation format");
            return;
        }
        if (operation.getType() == null) {
            sendError(session, "Operation type is required");
            return;
        }
        if ("PRESENCE".equals(operation.getType())) {
            broadcastPresence(session, message);
            return;
        }
        if ("UNDO".equals(operation.getType())
                || "REDO".equals(operation.getType())) {
            handleHistoryAction(session, operation.getType());
            return;
        }
        if(!operation.getType().equals("CREATE_OBJECT")
                && operation.getObjectId() == null) {
            sendError(session, "Object ID is required");
            return;
        }

        String canvasId = extractCanvasId(session);
        operation.setOperationId(UUID.randomUUID().toString());

        dispatchOperation(session, canvasId, operation, true);
    }

    /**
     * Assigns the next sequence, applies the operation, logs it, records history and
     * broadcasts it. Synthesized undo/redo operations pass {@code recordHistory=false}
     * because {@link CanvasHistory} has already moved the entry between its stacks.
     */
    private void dispatchOperation(
            WebSocketSession session,
            String canvasId,
            CanvasOperation operation,
            boolean recordHistory) throws IOException {

        String clientId = clientIds.get(session.getId());
        AtomicLong sequence = canvasSequences.computeIfAbsent(canvasId,
                id -> new AtomicLong());

        long sequenceNumber = sequence.incrementAndGet();
        operation.setSequence(sequenceNumber);
        AtomicLong lastApplied = lastAppliedSequences.computeIfAbsent(canvasId,
                id -> new AtomicLong());

        synchronized (lastApplied) {
            if (operation.getSequence() <= lastApplied.get()) {
                sendError(session, "Stale operation");
                return;
            }

            CanvasService.OperationResult result;
            try {
                result = applyOperation(canvasId, operation);
            } catch (Exception exception) {
                // Never let a failed apply kill the socket: report it and keep the client
                // connected so state can resync.
                log.error(
                        "Failed to apply {} operation on canvas {}",
                        operation.getType(),
                        canvasId,
                        exception
                );
                sendError(session, "Failed to apply operation");
                return;
            }

            if (!result.success()) {
                sendError(session, result.error());
                return;
            }

            lastApplied.set(operation.getSequence());

            // Audit/history only: fire-and-forget, never blocks or fails the operation.
            canvasOperationProducer.publish(canvasId, clientId, operation);

            if (recordHistory) {
                histories.computeIfAbsent(canvasId, id -> new CanvasHistory())
                        .record(clientId, operation, result.before(), result.after());
            }

            broadcastOperation(canvasId, operation, session);
            sendHistoryState(session, canvasId, clientId);
        }
    }

    private void handleHistoryAction(
            WebSocketSession session,
            String action) throws IOException {

        String canvasId = extractCanvasId(session);
        String clientId = clientIds.get(session.getId());
        CanvasHistory history = histories.get(canvasId);

        CanvasOperation synthesized = null;
        if (history != null) {
            synthesized = "UNDO".equals(action)
                    ? history.undo(clientId)
                    : history.redo(clientId);
        }

        if (synthesized == null) {
            // Nothing to undo/redo for this client; just refresh the button state.
            sendHistoryState(session, canvasId, clientId);
            return;
        }

        synthesized.setOperationId(UUID.randomUUID().toString());
        dispatchOperation(session, canvasId, synthesized, false);
    }

    private void sendHistoryState(
            WebSocketSession session,
            String canvasId,
            String clientId) throws IOException {

        CanvasHistory history = histories.get(canvasId);

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("canUndo", history != null && history.canUndo(clientId));
        metadata.put("canRedo", history != null && history.canRedo(clientId));

        CanvasMessage message = new CanvasMessage();
        message.setType("HISTORY_STATE");
        message.setCanvasId(canvasId);
        message.setClientId(clientId);
        message.setMetadata(metadata);

        sendMessage(session, new TextMessage(objectMapper.writeValueAsString(message)));
    }
    @Override
    public void afterConnectionClosed(
            WebSocketSession session,
            CloseStatus status) throws IOException {

        String canvasId = extractCanvasId(session);

        String clientId = clientIds.remove(session.getId());

        Set<WebSocketSession> clients = rooms.get(canvasId);

        if (clients == null) {
            return;
        }

        clients.remove(session);

        if (clientId != null) {
            broadcastClientLeft(canvasId, clientId);
        }


        if (clients.isEmpty()) {
            rooms.remove(canvasId, clients);
            canvasSequences.remove(canvasId);
            lastAppliedSequences.remove(canvasId);
            histories.remove(canvasId);
        }

        log.info("Client {} disconnected from canvas {}", clientId, canvasId
        );
    }

    private String extractCanvasId(
            WebSocketSession session) {

        String path = session.getUri().getPath();

        String[] parts = path.split("/");

        return parts[parts.length - 1];
    }

    private CanvasService.OperationResult applyOperation(
            String canvasId,
            CanvasOperation operation) {

        switch (operation.getType()) {
            case "CREATE_OBJECT" -> {
                return canvasService.createObject(
                        canvasId,
                        operation.getObjectId(),
                        operation.getObjectType() == null
                                ? "RECTANGLE"
                                : operation.getObjectType(),
                        operation.getX(),
                        operation.getY(),
                        operation.getWidth(),
                        operation.getHeight(),
                        operation.getRotation(),
                        operation.getColor(),
                        operation.getStrokeColor(),
                        operation.getStrokeWidth(),
                        operation.getText(),
                        operation.getTextColor()
                );
            }
            case "MOVE_OBJECT" -> {
                return canvasService.moveObject(
                        canvasId,
                        operation.getObjectId(),
                        operation.getX(),
                        operation.getY()
                );
            }
            case "DELETE_OBJECT" -> {
                return canvasService.deleteObject(
                        canvasId,
                        operation.getObjectId()
                );
            }
            case "UPDATE_OBJECT" -> {
                return canvasService.updateObject(
                        canvasId,
                        operation
                );
            }
            default -> {
                return CanvasService.OperationResult.failure(
                        "Unknown operation: " + operation.getType());
            }
        }
    }


    private void broadcastOperation(
            String canvasId,
            CanvasOperation operation,
            WebSocketSession sender) throws IOException {

        Set<WebSocketSession> clients =
                rooms.get(canvasId);

        if (clients == null) {
            return;
        }
        String clientId = clientIds.get(sender.getId());
        CanvasMessage message =
                new CanvasMessage();

        message.setClientId(clientId);
        message.setType("OPERATION");
        message.setPayload(operation);
        message.setCanvasId(canvasId);

        String json =
                objectMapper.writeValueAsString(message);

        for (WebSocketSession client : clients) {
            sendMessage(client, new TextMessage(json));
        }
    }
    private String extractClientId(WebSocketSession session) {

        String query = session.getUri().getQuery();

        if (query == null) {
            return null;
        }

        for (String parameter : query.split("&")) {

            String[] parts = parameter.split("=");

            if (parts.length == 2 &&
                    parts[0].equals("clientId")) {

                return parts[1];
            }
        }

        return null;
    }
    private Set<String> getConnectedClientIds(
            String canvasId) {

        Set<WebSocketSession> clients =
                rooms.get(canvasId);

        if (clients == null) {
            return Set.of();
        }

        return clients.stream()
                .map(client -> clientIds.get(client.getId()))
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
    }
    private void broadcastClientJoined(
            String canvasId,
            String clientId,
            WebSocketSession joiningSession) throws IOException {

        Set<WebSocketSession> clients = rooms.get(canvasId);

        if (clients == null) {
            return;
        }

        CanvasMessage message = new CanvasMessage();
        message.setType("CLIENT_JOINED");
        message.setClientId(clientId);
        message.setCanvasId(canvasId);

        String json =
                objectMapper.writeValueAsString(message);

        for (WebSocketSession client : clients) {
            if (!client.getId().equals(joiningSession.getId())) {
                sendMessage(client, new TextMessage(json));
            }
        }
    }
    private void broadcastClientLeft(
            String canvasId,
            String clientId) throws IOException {

        Set<WebSocketSession> clients =
                rooms.get(canvasId);

        if (clients == null) {
            return;
        }

        CanvasMessage message = new CanvasMessage();
        message.setType("CLIENT_LEFT");
        message.setClientId(clientId);
        message.setCanvasId(canvasId);

        String json =
                objectMapper.writeValueAsString(message);

        for (WebSocketSession client : clients) {
            sendMessage(client, new TextMessage(json));
        }
    }
    private void sendError(
            WebSocketSession session,
            String message) throws IOException {

        CanvasMessage errorMessage =
                new CanvasMessage();

        errorMessage.setType("ERROR");
        errorMessage.setCanvasId(
                extractCanvasId(session)
        );
        errorMessage.setPayload(message);

        sendMessage(session, new TextMessage(objectMapper.writeValueAsString(errorMessage)));
    }

    /**
     * Sends a message on a session, serialized per session. A {@link WebSocketSession} is not
     * safe for concurrent sends; two threads writing at once makes Tomcat throw
     * "The remote endpoint was in state [TEXT_PARTIAL_WRITING]", which drops the message for
     * that client and leaves clients with divergent state.
     */
    private void sendMessage(WebSocketSession session, TextMessage message) throws IOException {
        if (!session.isOpen()) {
            return;
        }
        synchronized (session) {
            if (session.isOpen()) {
                session.sendMessage(message);
            }
        }
    }

    @SuppressWarnings("unchecked")
    private void broadcastPresence(
            WebSocketSession sender,
            TextMessage rawMessage) throws IOException {

        String canvasId = extractCanvasId(sender);
        String clientId = clientIds.get(sender.getId());

        Set<WebSocketSession> clients = rooms.get(canvasId);
        if (clients == null) {
            return;
        }

        Map<String, Object> parsed = objectMapper.readValue(
                rawMessage.getPayload(), Map.class);

        Object cursor = parsed.get("cursor");
        if (cursor == null) {
            sendError(sender, "Cursor data is required for PRESENCE");
            return;
        }

        Map<String, Object> outbound = new LinkedHashMap<>();
        outbound.put("type", "PRESENCE");
        outbound.put("clientId", clientId != null ? clientId : sender.getId());
        outbound.put("cursor", cursor);
        outbound.put("canvasId", canvasId);

        String json = objectMapper.writeValueAsString(outbound);

        for (WebSocketSession client : clients) {
            if (!client.getId().equals(sender.getId())) {
                sendMessage(client, new TextMessage(json));
            }
        }
    }
}