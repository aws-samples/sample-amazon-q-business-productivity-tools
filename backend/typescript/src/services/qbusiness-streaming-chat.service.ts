// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Injectable, Logger } from '@nestjs/common';
import { QBusinessClient, ChatCommand } from '@aws-sdk/client-qbusiness';
import * as dotenv from 'dotenv';
import { getClientWithSessionAsync } from './aws-client.utils';
import { DynamoDBService } from './dynamodb.service';
import { Response } from 'express';

// Load environment variables
dotenv.config();

export enum ChatMode {
  RETRIEVAL_MODE = 'RETRIEVAL_MODE',
  PLUGIN_MODE = 'PLUGIN_MODE',
}

@Injectable()
export class QBusinessStreamingChatService {
  private readonly logger = new Logger(QBusinessStreamingChatService.name);
  private readonly qbusinessClient: QBusinessClient;
  private readonly region: string;

  constructor(private readonly dynamoDBService: DynamoDBService) {
    // Get region from environment variables or use default
    this.region = process.env.AWS_REGION || 'us-east-1';

    // Initialize AWS client for QBusiness
    this.qbusinessClient = new QBusinessClient({ region: this.region });
  }

  /**
   * Chat with Q Business AI using the Chat API with streaming response
   * @param applicationId The QBusiness application ID
   * @param message The user message content
   * @param res Express response object for SSE
   * @param conversationId Optional conversation ID for continuing a chat
   * @param systemMessageId Optional system message ID for threading
   * @param attributeFilter Optional attribute filter for retrieval mode
   * @param selectedPlugin Optional plugin ID for plugin mode
   * @param actionExecution Optional action execution details
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @param credentials Optional AWS credentials
   * @param region Optional AWS region
   */
  async chatStream(
    applicationId: string,
    message: string,
    res: Response,
    conversationId?: string,
    systemMessageId?: string,
    attributeFilter?: any,
    selectedPlugin?: string,
    actionExecution?: any,
    sessionId?: string,
    credentials?: any,
    region?: string,
  ): Promise<void> {
    try {
      this.logger.log(
        `Starting chat stream with application ${applicationId} and sessionId ${sessionId}`,
      );

      // Use provided region or default
      const regionToUse = region || this.region;

      // Create a client with session credentials if session_id is provided
      const clientToUse = await getClientWithSessionAsync<QBusinessClient>(
        'qbusiness',
        regionToUse,
        this.qbusinessClient,
        sessionId,
        credentials,
        this.dynamoDBService,
      );

      // Create the input object with the required parameters
      const inputParams: any = {
        applicationId,
        inputStream: this.createInputStreamGenerator(
          message,
          attributeFilter,
          selectedPlugin,
        ),
      };

      // Add conversationId if provided
      if (conversationId) {
        inputParams.conversationId = conversationId;
      }

      // Add parentMessageId if provided
      if (systemMessageId) {
        inputParams.parentMessageId = systemMessageId;
      }

      this.logger.log(
        `Calling chat with params: ${JSON.stringify(inputParams)}`,
      );

      // Call the chat API
      const command = new ChatCommand(inputParams);

      try {
        const response = await clientToUse.send(command);

        // Variables to track the state across chunks
        let responseConversationId = '';
        let responseSystemMessageId = '';
        let sourceAttributions: any[] = [];

        // Process the outputStream and write directly to response
        if (response.outputStream) {
          // Process each event from the output stream
          for await (const event of response.outputStream) {
            if (event.textEvent) {
              const textEvent = event.textEvent;
              const textContent = textEvent.systemMessage || '';

              // Only set these once if they're not already set
              if (!responseConversationId && textEvent.conversationId) {
                responseConversationId = textEvent.conversationId;
              }
              if (!responseSystemMessageId && textEvent.systemMessageId) {
                responseSystemMessageId = textEvent.systemMessageId;
              }

              // Write the text chunk directly to the response
              if (textContent) {
                const data = {
                  type: 'text',
                  content: textContent,
                  conversationId: responseConversationId,
                  systemMessageId: responseSystemMessageId,
                };
                res.write(`data: ${JSON.stringify(data)}\n\n`);
                // Try to flush the response if the method exists
                if (typeof (res as any).flush === 'function') {
                  (res as any).flush();
                }
              }
            }

            if (event.metadataEvent) {
              const metadataEvent = event.metadataEvent;
              // Get source attributions from metadata event
              sourceAttributions = metadataEvent.sourceAttributions || [];

              // Write the metadata directly to the response
              const data = {
                type: 'metadata',
                sourceAttributions,
                conversationId:
                  metadataEvent.conversationId || responseConversationId,
                systemMessageId:
                  metadataEvent.systemMessageId || responseSystemMessageId,
              };
              res.write(`data: ${JSON.stringify(data)}\n\n`);
              // Try to flush the response if the method exists
              if (typeof (res as any).flush === 'function') {
                (res as any).flush();
              }
            }
          }
        }

        // Signal that the stream is complete
        const data = {
          type: 'complete',
          isComplete: true,
          conversationId: responseConversationId,
          systemMessageId: responseSystemMessageId,
          sourceAttributions,
        };
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        res.end();
      } catch (error) {
        this.logger.error(`Error in chat stream: ${error}`);
        // Write error response directly to the response
        const errorData = {
          type: 'error',
          message:
            error.message || 'An error occurred while processing your request',
        };
        res.write(`data: ${JSON.stringify(errorData)}\n\n`);
        res.end();
      }
    } catch (error) {
      this.logger.error(`Error setting up chat stream: ${error}`);
      // Write error response directly to the response
      const errorData = {
        type: 'error',
        message:
          error.message || 'An error occurred while setting up the chat stream',
      };
      res.write(`data: ${JSON.stringify(errorData)}\n\n`);
      res.end();
    }
  }

  /**
   * Create an input stream generator for the Chat API
   * @param message The user message
   * @param attributeFilter Optional attribute filter for retrieval mode
   * @param selectedPlugin Optional plugin ID for plugin mode
   * @returns An async generator that yields input events
   */
  private createInputStreamGenerator(
    message: string,
    attributeFilter?: any,
    selectedPlugin?: string,
  ): AsyncGenerator<any, void, unknown> {
    async function* inputStreamGenerator() {
      if (attributeFilter) {
        yield {
          configurationEvent: {
            chatMode: ChatMode.RETRIEVAL_MODE,
            attributeFilter,
          },
        };
      } else if (selectedPlugin) {
        yield {
          configurationEvent: {
            chatMode: ChatMode.PLUGIN_MODE,
            chatModeConfiguration: {
              pluginConfiguration: {
                pluginId: selectedPlugin,
              },
            },
          },
        };
      }

      // Then yield the text event with the user message
      yield {
        textEvent: {
          userMessage: message,
        },
      };

      // End the input stream
      yield { endOfInputEvent: {} };
    }

    return inputStreamGenerator();
  }
}
