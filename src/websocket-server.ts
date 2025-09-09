import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';

interface NotificationMessage {
  type: 'notification';
  data: {
    id: string;
    title: string;
    body: string;
    imageUrl?: string;
    typeId: string;
    isActive: boolean;
    isGlobal: boolean;
    targetUserIds: string[];
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    expiresAt?: string;
    createdAt: string;
    updatedAt: string;
    type: {
      id: string;
      name: string;
      displayName: string;
      icon?: string;
      color?: string;
    };
  };
}

interface ClientConnection {
  ws: WebSocket;
  userId?: string;
  isAdmin?: boolean;
}

class NotificationWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ClientConnection> = new Map();
  private adminClients: Set<string> = new Set();

  constructor() {
    this.setupWebSocketServer();
  }

  private setupWebSocketServer() {
    // This will be called when the server starts
    // The actual WebSocket server will be created in the API route
  }

  public createWebSocketServer(server: any) {
    console.log('🔧 Creating WebSocket server...');
    this.wss = new WebSocketServer({ 
      server,
      path: '/api/notifications/ws'
    });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      const clientId = this.generateClientId();
      const clientIP = request.socket.remoteAddress;
      
      console.log(`🔌 New WebSocket connection: ${clientId} from ${clientIP}`);
      console.log(`📊 Total connected clients: ${this.clients.size + 1}`);
      
      this.clients.set(clientId, { ws });

      ws.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          console.log(`📨 Message from ${clientId}:`, data.type);
          this.handleMessage(clientId, data);
        } catch (error) {
          console.error(`❌ Error parsing message from ${clientId}:`, error);
        }
      });

      ws.on('close', (code: number, reason: Buffer) => {
        console.log(`🔌 WebSocket connection closed: ${clientId} (code: ${code}, reason: ${reason.toString()})`);
        this.clients.delete(clientId);
        this.adminClients.delete(clientId);
        console.log(`📊 Remaining connected clients: ${this.clients.size}`);
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for ${clientId}:`, error);
        this.clients.delete(clientId);
        this.adminClients.delete(clientId);
        console.log(`📊 Remaining connected clients: ${this.clients.size}`);
      });

      // Send connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        clientId
      }));
      
      console.log(`✅ Connection confirmation sent to ${clientId}`);
    });

    console.log('✅ WebSocket server started on /api/notifications/ws');
  }

  private generateClientId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private handleMessage(clientId: string, data: any) {
    const client = this.clients.get(clientId);
    if (!client) {
      console.log(`❌ Client ${clientId} not found for message handling`);
      return;
    }

    console.log(`🔄 Handling message from ${clientId}:`, data.type);

    switch (data.type) {
      case 'authenticate':
        console.log(`🔐 Authenticating client ${clientId} as user ${data.userId} (admin: ${data.isAdmin})`);
        this.authenticateClient(clientId, data.userId, data.isAdmin);
        break;
      case 'ping':
        console.log(`🏓 Ping received from ${clientId}, sending pong`);
        client.ws.send(JSON.stringify({ type: 'pong' }));
        break;
      default:
        console.log(`❓ Unknown message type from ${clientId}:`, data.type);
    }
  }

  private authenticateClient(clientId: string, userId: string, isAdmin: boolean) {
    const client = this.clients.get(clientId);
    if (!client) {
      console.log(`❌ Client ${clientId} not found for authentication`);
      return;
    }

    client.userId = userId;
    client.isAdmin = isAdmin;

    if (isAdmin) {
      this.adminClients.add(clientId);
      console.log(`👑 Admin client authenticated: ${clientId} (${userId})`);
    } else {
      console.log(`👤 User client authenticated: ${clientId} (${userId})`);
    }

    client.ws.send(JSON.stringify({
      type: 'authenticated',
      userId,
      isAdmin
    }));
    
    console.log(`✅ Authentication confirmation sent to ${clientId}`);
  }

  public broadcastNotification(notification: NotificationMessage['data']) {
    console.log('📢 Broadcasting notification:', {
      id: notification.id,
      title: notification.title,
      isGlobal: notification.isGlobal,
      targetUserIds: notification.targetUserIds
    });

    const message: NotificationMessage = {
      type: 'notification',
      data: notification
    };

    let sentCount = 0;
    let skippedCount = 0;

    // Send to all connected clients
    this.clients.forEach((client, clientId) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        // Check if notification should be sent to this user
        if (this.shouldSendToUser(client, notification)) {
          try {
            client.ws.send(JSON.stringify(message));
            sentCount++;
            console.log(`✅ Notification sent to client ${clientId} (user: ${client.userId || 'unauthenticated'})`);
          } catch (error) {
            console.error(`❌ Failed to send notification to client ${clientId}:`, error);
          }
        } else {
          skippedCount++;
          console.log(`⏭️  Notification skipped for client ${clientId} (user: ${client.userId || 'unauthenticated'}) - not targeted`);
        }
      } else {
        console.log(`❌ Client ${clientId} WebSocket not open (state: ${client.ws.readyState})`);
      }
    });

    console.log(`📊 Notification broadcast complete: ${sentCount} sent, ${skippedCount} skipped, ${this.clients.size} total clients`);
  }

  private shouldSendToUser(client: ClientConnection, notification: NotificationMessage['data']): boolean {
    // If it's a global notification, send to everyone
    if (notification.isGlobal) {
      return true;
    }

    // If user is not authenticated, don't send
    if (!client.userId) {
      return false;
    }

    // If notification is targeted to specific users, check if this user is included
    if (notification.targetUserIds.includes(client.userId)) {
      return true;
    }

    return false;
  }

  public broadcastToAdmins(message: any) {
    this.adminClients.forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }

  public getAdminClientsCount(): number {
    return this.adminClients.size;
  }
}

// Singleton instance
export const notificationWebSocketServer = new NotificationWebSocketServer();
