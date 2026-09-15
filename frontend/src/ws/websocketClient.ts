import type { InboundMessage, OutboundMessage } from '../types/canvas';

export type WebSocketEventHandlers = {
  onMessage: (message: InboundMessage) => void;
  onCanvasNotFound: () => void;
  onConnected: () => void;
  onDisconnected: () => void;
};

/**
 * Standalone WebSocket client for the collaborative canvas.
 * Reconnects with exponential backoff on unexpected disconnects.
 */
export class CanvasWebSocketClient {
  ws: WebSocket | null = null;
  reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  reconnectDelay = 1000;
  shouldReconnect = true;
  canvasId: string;
  clientId: string;
  handlers: WebSocketEventHandlers;

  constructor(
    canvasId: string,
    clientId: string,
    handlers: WebSocketEventHandlers,
  ) {
    this.canvasId = canvasId;
    this.clientId = clientId;
    this.handlers = handlers;
  }

  connect(): void {
    this.shouldReconnect = true;
    this.createConnection();
  }

  createConnection(): void {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${scheme}://${window.location.host}/ws/canvas/${this.canvasId}?clientId=${this.clientId}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectDelay = 1000; // reset backoff
      this.handlers.onConnected();
    };

    this.ws.onclose = (event) => {
      this.handlers.onDisconnected();

      // 1008 = Policy Violation → canvas not found
      if (event.code === 1008) {
        this.shouldReconnect = false;
        this.handlers.onCanvasNotFound();
        return;
      }

      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // The close handler will fire after this, so we don't need to do anything here
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as InboundMessage;
        if (data && data.type) {
          this.handlers.onMessage(data);
        }
      } catch {
        console.warn('[WS] Failed to parse message:', event.data);
      }
    };
  }

  scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 16000);
      this.createConnection();
    }, this.reconnectDelay);
  }

  send(message: OutboundMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
  }
}
