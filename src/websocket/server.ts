import { WebSocket, WebSocketServer as WSServer } from 'ws';
import { Server as HTTPServer } from 'http';
import { RoomMessage, MessageType, SendMessageData, JoinRoomMessage } from './protocol.js';
import { ChatMessage, Role } from '../types/message.js';
import { MessageHandler } from './handler.js';
import type { WebSocketMessage } from './protocol.js';

export { WebSocketMessage, MessageType };

export interface ClientMap {
  [address: string]: { 
    ws: WebSocket;
    rooms: Set<string>;
  };
}

export interface RoomMap {
  [roomId: string]: Set<string>;
}

export class WebSocketServer {
  private server: WSServer | null = null;
  private clients: ClientMap = {};
  private rooms: RoomMap = {};
  private port: number;
  private messageHandler: MessageHandler;

  constructor(port: number, messageHandler: MessageHandler) {
    this.port = port;
    this.messageHandler = messageHandler;
  }

  attachToServer(httpServer: HTTPServer): void {
    this.server = new WSServer({ 
      server: httpServer,
      path: '/' // Chat WebSocket on root path
    });
    this.setupConnectionHandlers();
  }

  start(): void {
    // Standalone mode - create server on port (for backward compatibility)
    this.server = new WSServer({ port: this.port });
    this.setupConnectionHandlers();
  }

  private setupConnectionHandlers(): void {
    if (!this.server) {
      throw new Error('WebSocket server not initialized');
    }
    
    this.server.on('connection', (ws: WebSocket, req) => {
      const address = req.socket.remoteAddress || 'unknown';
      
      // Register client
      this.clients[address] = {
        ws,
        rooms: new Set()
      };

      // Send welcome message
      this.sendMessage(ws, {
        type: MessageType.ConnectionEstablished,
        payload: { message: "Welcome to AI Orchestrator WebSocket server!" },
        timestamp: Date.now(),
        message_id: `msg_${Date.now()}`
      });

      // Handle incoming messages
      ws.on('message', (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.handleMessage(address, message);
        } catch (error) {
          console.error('❌ [WebSocketServer] Error parsing message:', error);
          this.sendMessage(ws, {
            type: MessageType.Error,
            payload: { error: "Invalid message format" },
            timestamp: Date.now(),
            message_id: `msg_${Date.now()}`
          });
        }
      });

      // Handle disconnect
      ws.on('close', () => {
        this.cleanup(address);
      });

      ws.on('error', (error) => {
        console.error(`[Chat] WebSocket error for ${address}:`, error);
      });
    });
  }

  private handleMessage(address: string, message: WebSocketMessage): void {
    switch (message.type) {
      case MessageType.JoinChat: {
        const joinData = message.payload as JoinRoomMessage;
        this.joinRoom(address, joinData.chat_id);
        break;
      }
      
      case MessageType.ChatMessage: {
        const chatData = message.payload as SendMessageData;
        this.handleChatMessage(address, chatData);
        break;
      }
      
      default:
        break;
    }
  }

  private joinRoom(address: string, roomId: string): void {
    if (!this.clients[address]) return;

    this.clients[address].rooms.add(roomId);
    
    if (!this.rooms[roomId]) {
      this.rooms[roomId] = new Set();
    }
    this.rooms[roomId].add(address);
  }

  private async handleChatMessage(address: string, data: SendMessageData): Promise<void> {
    const userMessage = data.message.payload;
    
    // Notify that message was received
    this.broadcastToRoom(data.chat_id, {
      type: MessageType.MessageReceived,
      payload: data.message,
      timestamp: Date.now(),
      message_id: `msg_${Date.now()}`
    });

    // Process the message with the orchestrator
    if (userMessage.role === Role.User) {
      await this.messageHandler.handleUserMessage(data.chat_id, userMessage, this);
    }
  }

  broadcastToRoom(roomId: string, message: WebSocketMessage): void {
    const participants = this.rooms[roomId];
    if (!participants) {
      return;
    }

    const messageStr = JSON.stringify(message);

    participants.forEach(address => {
      const client = this.clients[address];
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    });
  }

  sendMessage(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private cleanup(address: string): void {
    const client = this.clients[address];
    if (!client) return;

    // Remove client from all rooms
    client.rooms.forEach(roomId => {
      const room = this.rooms[roomId];
      if (room) {
        room.delete(address);
        if (room.size === 0) {
          delete this.rooms[roomId];
        }
      }
    });

    delete this.clients[address];
  }
}

