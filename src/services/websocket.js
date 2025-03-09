import { ref } from 'vue';

const WS_URL = `ws://${window.location.hostname}:3001`;

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
  }

  async connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.setupMessageHandler();
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          this.handleDisconnect();
        };
      } catch (error) {
        console.error('WebSocket connection error:', error);
        reject(error);
      }
    });
  }

  setupMessageHandler() {
    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.requestId && this.pendingRequests.has(message.requestId)) {
          const { resolve, reject } = this.pendingRequests.get(message.requestId);
          this.pendingRequests.delete(message.requestId);

          if (message.error) {
            reject(new Error(message.error));
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
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const requestId = this.nextRequestId++;

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('WebSocket request timed out'));
        }
      }, 30000); // 30 second timeout

      // Store the promise callbacks
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

      // Send the request
      this.ws.send(JSON.stringify({
        type,
        requestId,
        data,
      }));
    });
  }

  handleDisconnect() {
    // Clear all pending requests
    for (const { reject } of this.pendingRequests.values()) {
      reject(new Error('WebSocket disconnected'));
    }
    this.pendingRequests.clear();

    // Attempt to reconnect if we haven't exceeded max attempts
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.connect().catch(console.error);
      }, 1000 * Math.min(this.reconnectAttempts, 5)); // Exponential backoff up to 5 seconds
    }
  }

  // API methods
  async getModels() {
    return this.sendRequest('getModels');
  }

  async getSamplers() {
    return this.sendRequest('getSamplers');
  }

  async getUpscalers() {
    return this.sendRequest('getUpscalers');
  }

  async getLatentUpscaleModes() {
    return this.sendRequest('getLatentUpscaleModes');
  }

  async setModel(model_name) {
    return this.sendRequest('setModel', { model_name });
  }

  async getConfigs() {
    return this.sendRequest('getConfigs');
  }

  async addConfig(config) {
    return this.sendRequest('addConfig', config);
  }

  async updateConfig(name, config) {
    return this.sendRequest('updateConfig', { name, config });
  }

  async deleteConfig(name) {
    return this.sendRequest('deleteConfig', { name });
  }

  async startGeneration(config) {
    return this.sendRequest('startGeneration', config);
  }

  async stopGeneration(configId) {
    return this.sendRequest('stopGeneration', { configId });
  }

  async queueTxt2img(config) {
    return this.sendRequest('queueTxt2img', config);
  }

  async queueUpscale(imagePath, config) {
    return this.sendRequest('queueUpscale', { imagePath, config });
  }

  async cancelJob(jobId) {
    return this.sendRequest('cancelJob', { jobId });
  }

  async checkServerStatus() {
    return this.sendRequest('getServerStatus');
  }
}

export const webSocketService = new WebSocketService();
