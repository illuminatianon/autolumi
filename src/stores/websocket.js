import { defineStore } from 'pinia';

const WS_URL = `ws://${window.location.hostname}:3001`;

export const useWebSocketStore = defineStore('websocket', {
  state: () => ({
    ws: null,
    connected: false,
    error: null,
    pendingRequests: new Map(),
    nextRequestId: 1,
    messageHandlers: new Map(),
  }),

  actions: {
    connect() {
      if (this.ws?.readyState === WebSocket.OPEN) return;

      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.connected = true;
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.connected = false;
        this.reconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.error = error;
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.requestId) {
            // Handle response to a specific request
            const { resolve, reject } = this.pendingRequests.get(message.requestId) || {};
            if (resolve && reject) {
              this.pendingRequests.delete(message.requestId);
              if (message.type === 'error') {
                reject(new Error(message.data.message));
              } else {
                resolve(message.data);
              }
            }
          }

          // Call registered handlers for this message type
          const handlers = this.messageHandlers.get(message.type) || [];
          handlers.forEach(handler => handler(message.data));
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
          this.error = error;
        }
      };
    },

    reconnect() {
      setTimeout(() => {
        console.log('Attempting to reconnect WebSocket...');
        this.connect();
      }, 5000);
    },

    async sendRequest(type, data) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket is not connected');
      }

      const requestId = this.nextRequestId++;
      const promise = new Promise((resolve, reject) => {
        this.pendingRequests.set(requestId, { resolve, reject });

        // Add timeout
        setTimeout(() => {
          if (this.pendingRequests.has(requestId)) {
            this.pendingRequests.delete(requestId);
            reject(new Error('WebSocket request timed out'));
          }
        }, 30000); // 30 second timeout
      });

      this.ws.send(JSON.stringify({ type, data, requestId }));
      return promise;
    },

    // Register a handler for a specific message type
    subscribe(messageType, handler) {
      if (!this.messageHandlers.has(messageType)) {
        this.messageHandlers.set(messageType, new Set());
      }
      this.messageHandlers.get(messageType).add(handler);
    },

    // Remove a handler for a specific message type
    unsubscribe(messageType, handler) {
      const handlers = this.messageHandlers.get(messageType);
      if (handlers) {
        handlers.delete(handler);
      }
    }
  },
});