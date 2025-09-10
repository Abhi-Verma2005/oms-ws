const { createServer } = require('http');
const { parse } = require('url');
const { notificationWebSocketServer } = require('./websocket-server.js');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0'; // Use 0.0.0.0 for Render
const port = process.env.PORT || process.env.WS_PORT || 8000; // Render uses PORT env var

// WebSocket URL utility function
function getWebSocketUrl() {
  if (dev) {
    return process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8000';
  }
  // For production, use the Render URL
  return process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'wss://oms-ws.onrender.com';
}

console.log('🚀 Starting WebSocket server...');
console.log(`📡 Environment: ${dev ? 'development' : 'production'}`);
console.log(`🌐 Hostname: ${hostname}`);
console.log(`🔌 Port: ${port}`);

const server = createServer(async (req, res) => {
  try {
    const parsedUrl = parse(req.url, true);
    const { pathname, query } = parsedUrl;

    // Log all incoming requests
    console.log(`📥 ${req.method} ${pathname} - ${new Date().toISOString()}`);

    // Health check endpoint
    if (pathname === '/health' || pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        message: 'WebSocket server is running',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        connectedClients: notificationWebSocketServer.getConnectedClientsCount(),
        adminClients: notificationWebSocketServer.getAdminClientsCount()
      }));
      return;
    }

    if (pathname === '/api/notifications/ws') {
      console.log('🔌 WebSocket connection attempt detected');
      console.log('📋 Headers:', {
        upgrade: req.headers.upgrade,
        connection: req.headers.connection,
        'sec-websocket-key': req.headers['sec-websocket-key'],
        'sec-websocket-version': req.headers['sec-websocket-version']
      });
      
      // Handle WebSocket upgrade
      if (req.headers.upgrade !== 'websocket') {
        console.log('❌ WebSocket upgrade failed - not a websocket request');
        res.writeHead(400);
        res.end('Expected WebSocket upgrade');
        return;
      }
      
      console.log('✅ WebSocket upgrade request validated, passing to WebSocket server');
      // The WebSocket server will handle this
      return;
    }

    // API endpoints
    if (pathname === '/api/broadcast' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const { notification } = JSON.parse(body);
          
          if (!notification) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Notification data is required' }));
            return;
          }

          console.log('📢 Broadcasting notification via API:', {
            id: notification.id,
            title: notification.title,
            isGlobal: notification.isGlobal
          });

          notificationWebSocketServer.broadcastNotification(notification);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: true, 
            message: 'Notification broadcasted successfully',
            connectedClients: notificationWebSocketServer.getConnectedClientsCount()
          }));
        } catch (error) {
          console.error('❌ Error processing broadcast request:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      });
      return;
    }

    // For other requests, return a simple response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      message: 'WebSocket server is running',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      connectedClients: notificationWebSocketServer.getConnectedClientsCount(),
      adminClients: notificationWebSocketServer.getAdminClientsCount()
    }));
  } catch (err) {
    console.error('❌ Error occurred handling', req.url, err);
    res.statusCode = 500;
    res.end('internal server error');
  }
});

// Set up WebSocket server
console.log('🔧 Setting up WebSocket server...');
notificationWebSocketServer.createWebSocketServer(server);
console.log('✅ WebSocket server configured');

server
  .once('error', (err) => {
    console.error('❌ Server error:', err);
    process.exit(1);
  })
  .listen(port, () => {
    const wsUrl = getWebSocketUrl();
    console.log('🎉 WebSocket server with API started successfully!');
    console.log(`🌐 HTTP Server: http://${hostname}:${port}`);
    console.log(`🔌 WebSocket Endpoint: ${wsUrl}/api/notifications/ws`);
    console.log(`📡 API Endpoint: http://${hostname}:${port}/api/broadcast`);
    console.log(`🏥 Health Check: http://${hostname}:${port}/health`);
    console.log('📊 Single port for both HTTP and WebSocket!');
    console.log('='.repeat(60));
  });
