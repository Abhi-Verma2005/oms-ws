const { WebSocketServer } = require('ws');

class NotificationWebSocketServer {
  constructor() {
    this.wss = null;
    this.clients = new Map();
    this.adminClients = new Set();
  } 

  createWebSocketServer(server) {
    console.log('🔧 Creating WebSocket server...');
    this.wss = new WebSocketServer({ 
      server,
      path: '/api/notifications/ws'
    });

    this.wss.on('connection', (ws, request) => {
      const clientId = this.generateClientId();
      const clientIP = request.socket.remoteAddress;
      
      console.log(`🔌 New WebSocket connection: ${clientId} from ${clientIP}`);
      console.log(`📊 Total connected clients: ${this.clients.size + 1}`);
      
      this.clients.set(clientId, { ws });

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          console.log(`📨 Message from ${clientId}:`, data.type);
          this.handleMessage(clientId, data);
        } catch (error) {
          console.error(`❌ Error parsing message from ${clientId}:`, error);
        }
      });

      ws.on('close', (code, reason) => {
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

  generateClientId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  handleMessage(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    console.log('WebSocket server received message:', data);

    switch (data.type) {
      case 'authenticate':
        console.log('Authenticating client:', clientId, 'userId:', data.userId, 'isAdmin:', data.isAdmin);
        this.authenticateClient(clientId, data.userId, data.isAdmin);
        break;
      case 'ping':
        client.ws.send(JSON.stringify({ type: 'pong' }));
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  authenticateClient(clientId, userId, isAdmin) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.userId = userId;
    client.isAdmin = isAdmin;

    if (isAdmin) {
      this.adminClients.add(clientId);
    }

    client.ws.send(JSON.stringify({
      type: 'authenticated',
      userId,
      isAdmin
    }));
  }

  broadcastNotification(notification) {
    console.log('📢 Broadcasting notification:', {
      id: notification.id,
      title: notification.title,
      isGlobal: notification.isGlobal,
      targetUserIds: notification.targetUserIds
    });

    const message = {
      type: 'notification',
      data: notification
    };

    let sentCount = 0;
    let skippedCount = 0;

    console.log(`📊 Starting broadcast to ${this.clients.size} connected clients`);

    // Send to all connected clients
    this.clients.forEach((client, clientId) => {
      if (client.ws.readyState === 1) { // WebSocket.OPEN
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

  shouldSendToUser(client, notification) {
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

  broadcastToAdmins(message) {
    this.adminClients.forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === 1) { // WebSocket.OPEN
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  getConnectedClientsCount() {
    return this.clients.size;
  }

  getAdminClientsCount() {
    return this.adminClients.size;
  }
}

// Singleton instance - this ensures only one instance exists across the entire app
const notificationWebSocketServer = new NotificationWebSocketServer();

module.exports = { notificationWebSocketServer };
