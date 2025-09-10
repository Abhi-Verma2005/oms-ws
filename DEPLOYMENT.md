# WebSocket Server Deployment Guide

## Render Deployment Configuration

### Environment Variables to Set in Render Dashboard:

```
NODE_ENV=production
NEXT_PUBLIC_WEBSOCKET_URL=wss://oms-ws.onrender.com
```

### How to Use Your Deployed Server:

#### 1. HTTP Endpoints:
- **Health Check**: `https://oms-ws.onrender.com/` or `https://oms-ws.onrender.com/health`
- **General API**: `https://oms-ws.onrender.com/` (returns server status)

#### 2. WebSocket Endpoint:
- **WebSocket URL**: `wss://oms-ws.onrender.com/api/notifications/ws`

### Client Configuration:

In your client application, use these URLs:

```javascript
// For WebSocket connections
const wsUrl = 'wss://oms-ws.onrender.com/api/notifications/ws';

// For HTTP health checks
const healthUrl = 'https://oms-ws.onrender.com/health';
```

### Key Points:

1. **Single Port**: Both HTTP and WebSocket use the same port (Render's PORT env var)
2. **HTTPS/WSS**: Render automatically provides HTTPS, so use `wss://` for WebSocket
3. **Health Check**: The server responds to both `/` and `/health` endpoints
4. **No Port Numbers**: You don't need to specify ports in the URL - Render handles this

### Testing Your Deployment:

1. **Test HTTP**: Visit `https://oms-ws.onrender.com/` in your browser
2. **Test WebSocket**: Use a WebSocket client to connect to `wss://oms-ws.onrender.com/api/notifications/ws`

### Render Service Configuration:

- **Build Command**: `pnpm install && pnpm build`
- **Start Command**: `pnpm start`
- **Health Check Path**: `/` or `/health`
