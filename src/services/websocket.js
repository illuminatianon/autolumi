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
    this.reconnectTimeout = null;
    this.pendingRequests = new Map();
    this.nextRequestId = 1;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      wsState.value.connected = true;
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      wsState.value.connected = false;
      this.reconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
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
        } else {
          // Handle broadcast messages
          switch (message.type) {
            case 'queueUpdate':
              wsState.value.queueStatus = message.data;
              break;
            default:
              console.warn('Unknown message type:', message.type);
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };
  }

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
  }

  reconnect() {
    if (this.reconnectTimeout) return;

    this.reconnectTimeout = setTimeout(() => {
      console.log('Attempting to reconnect WebSocket...');
      this.connect();
    }, 5000);
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
}

export const webSocketService = new WebSocketService();
