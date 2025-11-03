import { OpenAIProvider, OpenAIModel, AvailableFunction, FunctionCallResponse } from '../llm/openai.js';
import { ChatMessage, Role } from '../types/message.js';
import { WebSocketServer } from '../websocket/server.js';
import { MessageType } from '../websocket/protocol.js';
import { browsePublishers, BrowsePublishersArgs, BrowsePublishersResult } from '../tools/publishers.js';
import { ChatHistoryManager } from './chat-history.js';

function safeArgs(value: unknown, maxLen: number = 600): string {
  try {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
  } catch {
    return '[unserializable]';
  }
}

export class OrchestratorService {
  private openai: OpenAIProvider;
  private chatHistory: ChatHistoryManager;

  constructor(openAiApiKey: string) {
    this.openai = new OpenAIProvider(openAiApiKey);
    this.chatHistory = new ChatHistoryManager();
  }

  private readonly SYSTEM_PROMPT = `You are an AI assistant with access to backend tools.

## Your Process:
1. Analyze the user's intent
2. Decide if you need tools or can respond directly
3. If tools are needed, call them with clear reasoning about your choice
4. Interpret the results and provide a helpful summary

## Available Tools:
- browsePublishers: Search publishers for backlinking opportunities

## Rules:
- For simple questions or greetings, respond directly without tools
- For data requests, use tools and explain results naturally
- Provide clear reasoning when choosing to use a tool
- Keep responses conversational and helpful

## Examples:
User: "Hi"
You: "Hello! How can I help you today?"

User: "Find publishers in tech"
You: "Let me search for tech publishers for you. [reasoning about using browsePublishers tool]"`;

  async processMessage(
    chatId: string,
    userMessage: ChatMessage,
    wsServer: WebSocketServer
  ): Promise<void> {
    try {
      // Add user message to history
      this.chatHistory.addMessage(chatId, userMessage);

      // Get conversation history for this chat
      const messageHistory = this.chatHistory.getHistory(chatId);
      
      // Build conversation with system prompt + history
      const conversation: ChatMessage[] = [
        { role: Role.System, content: this.SYSTEM_PROMPT },
        ...messageHistory
      ];

      // STEP 1: Analyze intent and decide on tool usage
      const analysisResponse = await this.openai.call(
        conversation,
        OpenAIModel.GPT35Turbo,
        true
      );

      const candidate = analysisResponse.candidates[0];
      if (!candidate || !candidate.content?.parts) {
        this.sendErrorMessage(chatId, 'No response from AI', wsServer);
        return;
      }

      const parts = candidate.content.parts;
      let functionToCall: FunctionCallResponse | null = null;
      let intentAnalysis = '';

      // Process intent analysis and tool decision
      for (const part of parts) {
        if (part.text && part.text.trim()) {
          intentAnalysis = part.text;
          
          // Stream the reasoning to frontend (but don't add to history yet - will add later)
          await this.streamTextResponse(chatId, part.text, wsServer);
        }

        if (part.functionCall) {
          functionToCall = part.functionCall;
          this.sendFunctionCallMessage(chatId, functionToCall, wsServer);
        }
      }

      // STEP 2: Execute tool if needed
      if (functionToCall) {
        // Notify frontend that tool execution is starting
        this.sendFunctionCallStartMessage(chatId, functionToCall.name, wsServer);
        
        const toolResult = await this.executeFunction(functionToCall, chatId, wsServer);

        // Notify frontend that tool execution completed
        this.sendFunctionCallEndMessage(chatId, functionToCall.name, wsServer);

        // If there was no intent analysis text, create a simple one
        const assistantContent = intentAnalysis || `I'm using the ${functionToCall.name} tool to help with your request.`;
        
        // For OpenAI, we don't add the function response here because we don't have the tool_call_id
        // Instead, we'll format it as text for the summary
        const formattedResult = typeof toolResult === 'object' 
          ? JSON.stringify(toolResult, null, 2)
          : String(toolResult);
        
        // Add to conversation for final summary with context
        conversation.push({
          role: Role.Assistant,
          content: assistantContent
        });
        
        // Add function result as a user message for context (OpenAI compatibility)
        conversation.push({
          role: Role.User,
          content: `The ${functionToCall.name} function returned: ${formattedResult}. Please summarize the results.`
        });

        this.chatHistory.addMessage(chatId, {
          role: Role.Assistant,
          content: assistantContent
        });
        
        this.chatHistory.addMessage(chatId, {
          role: Role.Function,
          content: JSON.stringify(toolResult),
          name: functionToCall.name
        });

        this.sendFunctionResultMessage(chatId, functionToCall.name, toolResult, wsServer);

        // STEP 3: Generate final summary
        const summaryResponse = await this.openai.call(
          conversation,
          OpenAIModel.GPT35Turbo,
          false // No functions needed for summary
        );

        const summaryCandidate = summaryResponse.candidates[0];

        if (summaryCandidate?.content?.parts) {
          let summaryText = '';
          for (const part of summaryCandidate.content.parts) {
            if (part.text && part.text.trim()) {
              summaryText = part.text;
              await this.streamTextResponse(chatId, part.text, wsServer);
              
              const finalMessage: ChatMessage = {
                role: Role.Assistant,
                content: part.text
              };
              this.chatHistory.addMessage(chatId, finalMessage);
            }
          }
        }
      } else {
        // No tool needed - just respond directly
        if (intentAnalysis) {
          const finalMessage: ChatMessage = {
            role: Role.Assistant,
            content: intentAnalysis
          };
          this.chatHistory.addMessage(chatId, finalMessage);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Try to have AI acknowledge the error gracefully
      try {
        const errorAckMessage: ChatMessage = {
          role: Role.User,
          content: `I encountered an error while processing your request: ${errorMessage}. Please acknowledge this error and explain to the user what happened.`
        };
        
        // Get conversation history
        const messageHistory = this.chatHistory.getHistory(chatId);
        const conversation: ChatMessage[] = [
          { role: Role.System, content: this.SYSTEM_PROMPT },
          ...messageHistory,
          errorAckMessage
        ];

        const errorResponse = await this.openai.call(
          conversation,
          OpenAIModel.GPT35Turbo,
          false // No functions needed for error acknowledgment
        );

        const errorCandidate = errorResponse.candidates?.[0];
        if (errorCandidate?.content?.parts) {
          for (const part of errorCandidate.content.parts) {
            if (part.text && part.text.trim()) {
              await this.streamTextResponse(chatId, part.text, wsServer);
              const errorAckFinal: ChatMessage = {
                role: Role.Assistant,
                content: part.text
              };
              this.chatHistory.addMessage(chatId, errorAckFinal);
            }
          }
        }
      } catch (ackError) {
        // If even the error acknowledgment fails, just send a simple error message
        this.sendErrorMessage(chatId, `Error: ${errorMessage}`, wsServer);
      }
    }
  }

  /**
   * Get chat history stats (for debugging)
   */
  getHistoryStats() {
    return this.chatHistory.getStats();
  }

  /**
   * Clear history for a specific chat
   */
  clearChatHistory(chatId: string) {
    this.chatHistory.clearHistory(chatId);
  }

  private async executeFunction(
    functionCall: FunctionCallResponse,
    chatId: string,
    wsServer: WebSocketServer
  ): Promise<unknown> {
    switch (functionCall.name) {
      case AvailableFunction.BrowsePublishers: {
        const publisherArgs = functionCall.args as unknown as BrowsePublishersArgs;
        try {
          // Call the function to get data
          const result: BrowsePublishersResult = await browsePublishers(publisherArgs);
          
          // Send FULL DATA directly to frontend (bypassing AI context)
          wsServer.broadcastToRoom(chatId, {
            type: MessageType.PublishersData,
            payload: {
              publishers: result.publishers,
              totalCount: result.totalCount,
              filters: result.filters
            },
            timestamp: Date.now(),
            message_id: `data_${Date.now()}`
          });
          
          // Return ONLY summary to AI context (saves tokens!)
          return {
            summary: result.summary,
            count: result.totalCount,
            message: 'Full results sent to user interface'
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            error: true,
            function: 'browsePublishers',
            message: `Failed to fetch publishers: ${errorMessage}`,
            details: 'The publisher search service encountered an error. Please try again later or adjust your search criteria.'
          };
        }
      }

      default:
        return {
          error: true,
          function: functionCall.name,
          message: `Unknown function: ${functionCall.name}`,
          details: 'This function is not available in the system.'
        };
    }
  }

  private sendFunctionCallMessage(
    chatId: string,
    functionCall: FunctionCallResponse,
    wsServer: WebSocketServer
  ): void {
    wsServer.broadcastToRoom(chatId, {
      type: MessageType.FunctionCall,
      payload: {
        ...functionCall,
        role: 'function'
      },
      timestamp: Date.now(),
      message_id: `msg_${Date.now()}`
    });
  }

  private sendFunctionCallStartMessage(
    chatId: string,
    functionName: string,
    wsServer: WebSocketServer
  ): void {
    wsServer.broadcastToRoom(chatId, {
      type: MessageType.FunctionCallStart,
      payload: {
        name: functionName
      },
      timestamp: Date.now(),
      message_id: `msg_${Date.now()}`
    });
  }

  private sendFunctionCallEndMessage(
    chatId: string,
    functionName: string,
    wsServer: WebSocketServer
  ): void {
    wsServer.broadcastToRoom(chatId, {
      type: MessageType.FunctionCallEnd,
      payload: {
        name: functionName
      },
      timestamp: Date.now(),
      message_id: `msg_${Date.now()}`
    });
  }

  private sendFunctionResultMessage(
    chatId: string,
    functionName: string,
    result: unknown,
    wsServer: WebSocketServer
  ): void {
    wsServer.broadcastToRoom(chatId, {
      type: MessageType.FunctionResult,
      payload: {
        name: functionName,
        result,
        role: 'function'
      },
      timestamp: Date.now(),
      message_id: `msg_${Date.now()}`
    });
  }

  private sendErrorMessage(chatId: string, error: string, wsServer: WebSocketServer): void {
    wsServer.broadcastToRoom(chatId, {
      type: MessageType.Error,
      payload: { error },
      timestamp: Date.now(),
      message_id: `msg_${Date.now()}`
    });
  }

  private async streamTextResponse(
    chatId: string,
    text: string,
    wsServer: WebSocketServer
  ): Promise<void> {
    // For now, send the full text as streaming isn't implemented in Gemini API yet
    // In the future, this can be enhanced with actual streaming
    const words = text.split(' ');
    const chunkSize = 5; // Stream 5 words at a time

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(' ') + (i + chunkSize < words.length ? ' ' : '');
      
      wsServer.broadcastToRoom(chatId, {
        type: MessageType.TextStream,
        payload: {
          text: chunk,
          isComplete: i + chunkSize >= words.length
        },
        timestamp: Date.now(),
        message_id: `stream_${Date.now()}`
      });

      // Small delay between chunks for streaming effect
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Send stream end notification
    wsServer.broadcastToRoom(chatId, {
      type: MessageType.TextStreamEnd,
      payload: { text },
      timestamp: Date.now(),
      message_id: `stream_end_${Date.now()}`
    });
  }
}

