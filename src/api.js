const express = require('express');
const cors = require('cors');
const { notificationWebSocketServer } = require('./websocket-server.js');

const app = express();
const port = process.env.WS_API_PORT || 8001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    connectedClients: notificationWebSocketServer.getConnectedClientsCount(),
    adminClients: notificationWebSocketServer.getAdminClientsCount()
  });
});

// Broadcast notification endpoint
app.post('/api/broadcast', (req, res) => {
  try {
    const { notification } = req.body;
    
    if (!notification) {
      return res.status(400).json({ error: 'Notification data is required' });
    }

    console.log('📡 Received broadcast request via HTTP API:', {
      id: notification.id,
      title: notification.title,
      isGlobal: notification.isGlobal
    });

    // Broadcast the notification
    notificationWebSocketServer.broadcastNotification(notification);

    res.json({
      success: true,
      message: 'Notification broadcasted successfully',
      connectedClients: notificationWebSocketServer.getConnectedClientsCount()
    });

  } catch (error) {
    console.error('❌ Error broadcasting notification:', error);
    res.status(500).json({ error: 'Failed to broadcast notification' });
  }
});

// Broadcast to admins only endpoint
app.post('/api/broadcast-admin', (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message data is required' });
    }

    console.log('📡 Received admin broadcast request via HTTP API');

    // Broadcast to admins only
    notificationWebSocketServer.broadcastToAdmins(message);

    res.json({
      success: true,
      message: 'Admin message broadcasted successfully',
      adminClients: notificationWebSocketServer.getAdminClientsCount()
    });

  } catch (error) {
    console.error('❌ Error broadcasting admin message:', error);
    res.status(500).json({ error: 'Failed to broadcast admin message' });
  }
});

// Get server stats endpoint
app.get('/api/stats', (req, res) => {
  res.json({
    connectedClients: notificationWebSocketServer.getConnectedClientsCount(),
    adminClients: notificationWebSocketServer.getAdminClientsCount(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Start the API server
app.listen(port, () => {
  console.log(`🌐 WebSocket API server running on port ${port}`);
  console.log(`📡 Health check: http://localhost:${port}/health`);
  console.log(`📊 Stats: http://localhost:${port}/api/stats`);
});

module.exports = app;
