import { WebSocketServer } from 'ws';
import logger from './logger.js';

export class WebSocketManager {
  constructor() {
    this.clients = new Set();
    this.handlers = new Map();
  }

  initialize(server) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
    });

    this.wss.on('connection', (ws, request) => {
      logger.info('Client connected to WebSocket', {
        ip: request.socket.remoteAddress,
      });

      this.clients.add(ws);

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data);
          await this.handleMessage(ws, message);
        } catch (error) {
          logger.error('Error handling WebSocket message:', error);
          this.sendError(ws, error.message);
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        logger.info('Client disconnected from WebSocket');
      });
    });
  }

  registerHandler(type, handler) {
    this.handlers.set(type, handler);
  }

  async handleMessage(ws, message) {
    const { type, data, requestId } = message;
    const handler = this.handlers.get(type);

    if (!handler) {
      this.sendError(ws, `Unknown message type: ${type}`, requestId);
      return;
    }

    try {
      const result = await handler(data);
      this.sendResponse(ws, { type: `${type}:response`, data: result }, requestId);
    } catch (error) {
      this.sendError(ws, error.message, requestId);
    }
  }

  broadcastConfigUpdate(configId, status) {
    const message = {
      type: 'configUpdate',
      data: status,
    };

    this.broadcast(message);
  }

  broadcast(message) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  sendResponse(ws, response, requestId) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ ...response, requestId }));
    }
  }

  sendError(ws, error, requestId) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'error',
        data: { message: error },
        requestId,
      }));
    }
  }
}
