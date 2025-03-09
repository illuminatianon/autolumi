import { ref } from 'vue';

const WS_PORT = import.meta.env.PROD ? window.location.port : '3001';

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
    this.connectPromise = null;
    this.isConnected = false;
  }

  async waitForConnection(timeout = 5000) {
    if (this.isConnected) return true;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, timeout);

      const checkConnection = () => {
        if (this.isConnected) {
          clearTimeout(timeoutId);
          resolve(true);
        } else if (this.ws?.readyState === WebSocket.CONNECTING) {
          setTimeout(checkConnection, 100);
        } else {
          clearTimeout(timeoutId);
          reject(new Error('Connection failed'));
        }
      };

      checkConnection();
    });
  }

  async connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.isConnected = true;
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = `${window.location.hostname}:${WS_PORT}`;
        const wsUrl = `${protocol}//${host}/ws`;

        console.log('Connecting to WebSocket at:', wsUrl);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connection established');
          this.reconnectAttempts = 0;
          this.isConnected = true;
          wsState.value.connected = true;
          this.setupMessageHandler();
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          wsState.value.connected = false;
          this.connectPromise = null;
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket connection closed'); // Debug log
          wsState.value.connected = false;
          this.handleDisconnect();
          this.connectPromise = null;
        };

        // Add connection timeout
        setTimeout(() => {
          if (this.ws.readyState !== WebSocket.OPEN) {
            this.ws.close();
            this.connectPromise = null;
            reject(new Error('WebSocket connection timeout'));
          }
        }, 5000);

      } catch (error) {
        console.error('WebSocket connection error:', error);
        this.connectPromise = null;
        reject(error);
      }
    });

    return this.connectPromise;
  }

  setupMessageHandler() {
    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.requestId && this.pendingRequests.has(message.requestId)) {
          const { resolve, reject } = this.pendingRequests.get(message.requestId);
          this.pendingRequests.delete(message.requestId);

          if (message.type === 'error') {
            reject(new Error(message.data.message));
          } else {
            resolve(message.data);
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };
  }

  async sendRequest(type, data = null) {
    await this.waitForConnection();

    const requestId = this.nextRequestId++;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('WebSocket request timed out'));
        }
      }, 30000);

      this.pendingRequests.set(requestId, {
        resolve: (data) => {
          clearTimeout(timeoutId);
          resolve(data);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
      });

      this.ws.send(JSON.stringify({
        type,
        requestId,
        data,
      }));
    });
  }

  async checkServerStatus() {
    return this.sendRequest('getServerStatus');
  }

  handleDisconnect() {
    for (const { reject } of this.pendingRequests.values()) {
      reject(new Error('WebSocket disconnected'));
    }
    this.pendingRequests.clear();

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 5000);
      console.log(`Attempting to reconnect in ${delay}ms...`); // Debug log
      setTimeout(() => {
        this.connect().catch(console.error);
      }, delay);
    }
  }
}

export const webSocketService = new WebSocketService();
