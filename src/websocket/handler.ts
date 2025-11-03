import { ChatMessage } from '../types/message.js';
import { WebSocketServer } from './server.js';
import { OrchestratorService } from '../orchestrator/service.js';

export class MessageHandler {
  private orchestrator: OrchestratorService;

  constructor(orchestrator: OrchestratorService) {
    this.orchestrator = orchestrator;
  }

  async handleUserMessage(
    chatId: string,
    userMessage: ChatMessage,
    wsServer: WebSocketServer
  ): Promise<void> {
    await this.orchestrator.processMessage(chatId, userMessage, wsServer);
  }
}

