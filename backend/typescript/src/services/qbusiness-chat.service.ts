// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Injectable, Logger } from '@nestjs/common';
import { QBusinessClient, ChatSyncCommand } from '@aws-sdk/client-qbusiness';
import * as dotenv from 'dotenv';
import { getClientWithSessionAsync } from './aws-client.utils';
import { DynamoDBService } from './dynamodb.service';

// Load environment variables
dotenv.config();

// Define enums
export enum ChatMode {
  RETRIEVAL_MODE = 'RETRIEVAL_MODE',
  PLUGIN_MODE = 'PLUGIN_MODE',
}

// Define interfaces for our return types
export interface ChatMessage {
  role: string;
  content: string;
}

export interface Citation {
  title: string;
  uri: string;
  snippet?: string;
}

export interface ChatResponse {
  chatId: string;
  message: string;
  systemMessageId?: string;
  sourceAttribution?: any[];
  citations: Citation[];
}

@Injectable()
export class QBusinessChatService {
  private readonly logger = new Logger(QBusinessChatService.name);
  private readonly client: QBusinessClient;
  private readonly region: string;

  constructor(private readonly dynamoDBService: DynamoDBService) {
    // Get region from environment variables or use default
    this.region = process.env.AWS_REGION || 'us-east-1';

    // Initialize AWS client for QBusiness
    this.client = new QBusinessClient({ region: this.region });
  }

  /**
   * Chat with Q Business AI using the ChatSync API
   * @param applicationId The QBusiness application ID
   * @param messages Array of chat messages with role and content
   * @param conversationId Optional conversation ID for continuing a chat
   * @param systemMessageId Optional system message ID for threading
   * @param attributeFilter Optional attribute filter for retrieval mode
   * @param selectedPlugin Optional plugin ID for plugin mode
   * @param actionExecution Optional action execution details
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns Chat response with message and citations
   */
  async chatSync(
    applicationId: string,
    messages: ChatMessage[],
    conversationId?: string,
    systemMessageId?: string,
    attributeFilter?: any,
    selectedPlugin?: string,
    actionExecution?: any,
    sessionId?: string,
  ): Promise<ChatResponse> {
    try {
      this.logger.log(
        `Starting chat sync with application ${applicationId} and sessionid ${sessionId}`,
      );

      // Create a client with session credentials if session_id is provided
      const clientToUse = await getClientWithSessionAsync<QBusinessClient>(
        'qbusiness',
        this.region,
        this.client,
        sessionId,
        undefined,
        this.dynamoDBService,
      );

      // Create the input object with the required parameters
      const inputParams: any = {
        applicationId,
        userMessage: messages[messages.length - 1].content, // Get the last message content
      };

      // Add conversationId if provided
      if (conversationId) {
        inputParams.conversationId = conversationId;
      }

      // Add parentMessageId if provided
      if (systemMessageId) {
        inputParams.parentMessageId = systemMessageId;
      }

      // Set chatMode and chatModeConfiguration based on conditions
      if (attributeFilter) {
        inputParams.attributeFilter = attributeFilter;
        inputParams.chatMode = ChatMode.RETRIEVAL_MODE;
      } else if (selectedPlugin) {
        inputParams.chatMode = ChatMode.PLUGIN_MODE;
        inputParams.chatModeConfiguration = {
          pluginConfiguration: {
            pluginId: selectedPlugin,
          },
        };
      }

      // Call the chat_sync API
      this.logger.log(
        `Calling chat_sync with params: ${JSON.stringify(inputParams)}`,
      );
      const command = new ChatSyncCommand(inputParams);
      const response = await clientToUse.send(command);

      // Extract data from response
      const responseData: ChatResponse = {
        chatId: response.conversationId || '',
        message: 'No response from AI',
        systemMessageId: response.systemMessageId,
        sourceAttribution: response.sourceAttributions,
        citations: [],
      };

      // Convert sourceAttributions to citations format for backward compatibility
      if (
        response.sourceAttributions &&
        response.sourceAttributions.length > 0
      ) {
        responseData.citations = response.sourceAttributions.map(
          (source, i) => ({
            title: source.title || `Source ${i + 1}`,
            uri: source.url || '#',
            snippet: source.snippet,
          }),
        );
      }

      // Handle systemMessage which might have different structure
      if (response.systemMessage) {
        // If systemMessage is a string
        if (typeof response.systemMessage === 'string') {
          responseData.message = response.systemMessage;
        } else {
          // If systemMessage is an object
          responseData.message = response.systemMessage as string;
        }
      }

      return responseData;
    } catch (error) {
      this.logger.error(`Error in chat sync: ${error}`);
      throw new Error(`Failed to get AI response: ${error}`);
    }
  }
}
