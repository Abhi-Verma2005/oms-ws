# WebSocket Server

This is a standalone WebSocket server for handling real-time notifications in the Mosaic Next.js application.

## Overview

The WebSocket server provides real-time communication capabilities for:
- Broadcasting notifications to connected clients
- Managing client authentication and admin privileges
- Handling connection lifecycle events

## Structure

```
ws-server/
├── src/
│   ├── websocket-server.ts    # TypeScript WebSocket server implementation
│   ├── websocket-server.js    # JavaScript WebSocket server implementation
│   ├── server.js              # Standalone server startup script
│   ├── index.js               # CommonJS exports
│   └── index.ts               # TypeScript exports
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
└── README.md                  # This file
```

## Installation

```bash
cd ws-server
npm install
```

## Usage

### Standalone Mode

Run the WebSocket server independently:

```bash
npm start
# or
npm run dev  # with file watching
```

The server will start on port 8001 by default (configurable via WS_PORT environment variable).

### Integration Mode

Import the WebSocket server in your Next.js application:

```javascript
const { notificationWebSocketServer } = require('../ws-server/src/websocket-server.js');
```

## Environment Variables

- `WS_PORT`: Port for the WebSocket server (default: 8001)
- `HOSTNAME`: Hostname for the server (default: localhost)
- `NODE_ENV`: Environment mode (development/production)

## API

### Methods

- `createWebSocketServer(server)`: Attach WebSocket functionality to an HTTP server
- `broadcastNotification(notification)`: Send notification to all connected clients
- `broadcastToAdmins(message)`: Send message to admin clients only
- `getConnectedClientsCount()`: Get number of connected clients
- `getAdminClientsCount()`: Get number of connected admin clients

### WebSocket Events

#### Client to Server
- `authenticate`: Authenticate client with user ID and admin status
- `ping`: Ping the server (responds with pong)

#### Server to Client
- `connected`: Connection confirmation with client ID
- `authenticated`: Authentication confirmation
- `notification`: Real-time notification data
- `pong`: Response to ping

## Development

### TypeScript

```bash
npm run build        # Compile TypeScript
npm run build:watch  # Compile with file watching
```

### Testing

The WebSocket server can be tested using the test script in the main project:

```bash
cd ../mosaic-next
node scripts/test-websocket.mjs
```

## Integration with Next.js

The WebSocket server is designed to work alongside the Next.js application. The main server.js file in the mosaic-next project integrates both the Next.js app and the WebSocket server on the same port.

## Security

- Client authentication is required for targeted notifications
- Admin privileges are checked for admin-only broadcasts
- Connection validation and error handling are implemented
