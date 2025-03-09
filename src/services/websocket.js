import { ref } from 'vue';

const WS_PORT = import.meta.env.PROD ? window.location.port : '3001';
const CONNECTION_TIMEOUT = 5000;
const REQUEST_TIMEOUT = 10000;

export const wsState = ref({
  connected: false,
  queueStatus: {
    jobs: [],
    completedJobs: [],
  },
});

class WebSocketService {
  constructor() {
    this.ws = null;
    this.nextRequestId = 1;
    this.pendingRequests = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.isConnected = false;
    this.connectionPromise = null;
    this.subscribers = new Map(); // Add subscribers map
  }

  getWebSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    // Use the correct port and path
    const port = WS_PORT || window.location.port;
    const wsPath = '/ws';

    // Construct URL with port only if it exists
    const portPart = port ? `:${port}` : '';
    return `${protocol}//${host}${portPart}${wsPath}`;
  }

  async connect() {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        console.log('Connecting to WebSocket...');
        this.ws = new WebSocket(this.getWebSocketUrl());

        const connectionTimeout = setTimeout(() => {
          if (this.ws.readyState !== WebSocket.OPEN) {
            this.ws.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, CONNECTION_TIMEOUT);

        this.ws.onopen = () => {
          console.log('WebSocket connection established');
          clearTimeout(connectionTimeout);
          this.reconnectAttempts = 0;
          this.isConnected = true;
          wsState.value.connected = true;
          this.setupMessageHandler();
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          wsState.value.connected = false;
          this.isConnected = false;
          clearTimeout(connectionTimeout);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket connection closed');
          wsState.value.connected = false;
          this.isConnected = false;
          this.handleDisconnect();
        };

      } catch (error) {
        console.error('WebSocket connection error:', error);
        reject(error);
      }
    }).finally(() => {
      this.connectionPromise = null;
    });

    return this.connectionPromise;
  }

  setupMessageHandler() {
    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('Received WebSocket message:', message);

        // Handle request-response messages
        if (message.requestId && this.pendingRequests.has(message.requestId)) {
          const { resolve, reject, timeout } = this.pendingRequests.get(message.requestId);
          clearTimeout(timeout);
          this.pendingRequests.delete(message.requestId);

          if (message.type === 'error') {
            reject(new Error(message.data.message));
          } else {
            resolve(message.data);
          }
        }

        // Handle subscribed messages
        const subscribers = this.subscribers.get(message.type) || [];
        subscribers.forEach(callback => {
          try {
            callback(message.data);
          } catch (error) {
            console.error('Error in subscriber callback:', error);
          }
        });
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };
  }

  async sendRequest(type, data = null) {
    if (!this.isConnected) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      const requestId = this.nextRequestId++;
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('WebSocket request timed out'));
        }
      }, REQUEST_TIMEOUT);

      this.pendingRequests.set(requestId, { resolve, reject, timeout: timeoutId });

      const message = {
        type,
        requestId,
        data,
      };

      console.log('Sending WebSocket request:', message);
      this.ws.send(JSON.stringify(message));
    });
  }

  async checkServerStatus() {
    return this.sendRequest('getServerStatus');
  }

  handleDisconnect() {
    // Clear all pending requests
    for (const [requestId, { reject, timeout }] of this.pendingRequests.entries()) {
      clearTimeout(timeout);
      reject(new Error('WebSocket disconnected'));
      this.pendingRequests.delete(requestId);
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 5000);
      console.log(`Attempting to reconnect in ${delay}ms... (Attempt ${this.reconnectAttempts})`);
      setTimeout(() => {
        this.connect().catch(console.error);
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  subscribe(type, callback) {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }
    this.subscribers.get(type).add(callback);
  }

  unsubscribe(type, callback) {
    const subscribers = this.subscribers.get(type);
    if (subscribers) {
      subscribers.delete(callback);
      if (subscribers.size === 0) {
        this.subscribers.delete(type);
      }
    }
  }
}

export const webSocketService = new WebSocketService();
