import { loadConfig } from './config.js';
import { WebSocketServer } from './websocket/server.js';
import { MessageHandler } from './websocket/handler.js';
import { OrchestratorService } from './orchestrator/service.js';
import { NotificationWebSocketServer } from './notifications/server.js';

async function main() {
  try {
    // Load configuration
    const config = loadConfig();
    
    // Initialize services
    const orchestrator = new OrchestratorService(config.openAiApiKey);
    const messageHandler = new MessageHandler(orchestrator);
    
    // Initialize Chat WebSocket Server (standalone on port)
    const chatServer = new WebSocketServer(config.wsPort, messageHandler);
    chatServer.start();
    
    // Initialize Notification WebSocket Server (standalone on port + 1)
    const notificationPort = config.wsPort + 1;
    const notificationServer = new NotificationWebSocketServer();
    notificationServer.createStandaloneWebSocketServer(notificationPort);

    // Graceful shutdown
    const shutdown = () => {
      if ((chatServer as any).server) {
        (chatServer as any).server.close();
      }
      if (notificationServer.wss) {
        notificationServer.wss.close();
      }
      process.exit(0);
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();

