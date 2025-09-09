const { createServer } = require('http');
const { parse } = require('url');
const { notificationWebSocketServer } = require('./websocket-server.js');
const api = require('./api.js');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = process.env.WS_PORT || 8000;

// WebSocket URL utility function
function getWebSocketUrl() {
  return process.env.WEBSOCKET_URL || 'ws://localhost:8000';
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

    // For other requests, return a simple response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      message: 'WebSocket server is running',
      status: 'healthy',
      timestamp: new Date().toISOString()
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
    console.log('🎉 WebSocket server started successfully!');
    console.log(`🌐 HTTP Server: http://${hostname}:${port}`);
    console.log(`🔌 WebSocket Endpoint: ${wsUrl}/api/notifications/ws`);
    console.log('📊 Monitoring WebSocket connections and notifications...');
    console.log('='.repeat(60));
  });
