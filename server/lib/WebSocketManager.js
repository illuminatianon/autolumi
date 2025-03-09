import { WebSocketServer } from 'ws';
import logger from './logger.js';

export class WebSocketManager {
  constructor() {
    this.clients = new Set();
    this.handlers = new Map();
  }

  initialize(server) {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws) => {
      logger.info('Client connected to WebSocket');
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
        logger.info('Client disconnected from WebSocket');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
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

  broadcast(type, data) {
    const message = JSON.stringify({ type, data });
    this.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(message);
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
