// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { API_BASE_URL } from '../../constants/apiConstants';
import { ServiceResult } from '../service.types';

// Types that match the backend API responses and requests
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: {
    title: string;
    uri: string;
    snippet?: string;
  }[];
  isStreaming?: boolean; // Added to track streaming state in UI
}

export interface ChatResponse {
  chatId?: string;
  message: string;
  systemMessageId?: string;
  sourceAttribution?: any[];
  citations?: {
    title: string;
    uri: string;
    snippet?: string;
  }[];
}

export interface ChatRequest {
  messages: ChatMessage[];
  conversationId?: string;
  systemMessageId?: string;
  attributeFilter?: any;
  selectedPlugin?: string;
  actionExecution?: any;
  sessionId?: string;
}

export interface StreamingChatRequest {
  message: string;
  conversationId?: string;
  systemMessageId?: string;
  attributeFilter?: any;
  selectedPlugin?: string;
  actionExecution?: any;
  sessionId?: string;
  credentials?: any;
  region?: string;
}

export interface StreamingChatResponse {
  type: 'text' | 'metadata' | 'complete' | 'error';
  content?: string;
  message?: string;
  conversationId?: string;
  systemMessageId?: string;
  sourceAttributions?: any[];
  isComplete?: boolean;
}

/**
 * QBusinessProxyChatService - A service to proxy chat requests to the backend QBusiness API
 */
export class QBusinessProxyChatService {
  private static instance: QBusinessProxyChatService;
  private apiClient: any; // Using any for now until axios is installed
  private baseUrl: string;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    // Get the base URL from constants
    this.baseUrl = API_BASE_URL;

    // Create fetch-based API client
    this.apiClient = {
      post: async (url: string, data: any) => {
        try {
          const response = await fetch(`${this.baseUrl}${url}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          });

          if (!response.ok) {
            return {
              response: {
                status: response.status,
                statusText: response.statusText,
              },
            };
          }

          return { data: await response.json() };
        } catch (error) {
          console.error('API request failed:', error);
          throw error;
        }
      },
    };
  }

  /**
   * Get singleton instance of QBusinessProxyChatService
   */
  public static getInstance(): QBusinessProxyChatService {
    if (!QBusinessProxyChatService.instance) {
      QBusinessProxyChatService.instance = new QBusinessProxyChatService();
    }
    return QBusinessProxyChatService.instance;
  }

  /**
   * Chat with Q Business AI using the ChatSync API
   * @param applicationId - The QBusiness application ID
   * @param request - The chat request parameters
   * @returns ServiceResult with chat response
   */
  public async chatSync(
    applicationId: string,
    request: ChatRequest,
  ): Promise<ServiceResult<ChatResponse>> {
    try {
      // Include applicationId in the request body
      const requestWithAppId = {
        ...request,
        applicationId: applicationId,
      };

      const response = await this.apiClient.post(
        `/api/chat/sync`,
        requestWithAppId,
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'ChatSyncFailed',
          message: 'Failed to get AI response',
          statusCode: error.response?.status || 500,
        },
      };
    }
  }

  /**
   * Chat with Q Business AI using the streaming Chat API
   * @param applicationId - The QBusiness application ID
   * @param request - The streaming chat request parameters
   * @returns ReadableStream for processing streaming responses
   */
  public chatStream(
    applicationId: string,
    request: StreamingChatRequest,
  ): ReadableStream<Uint8Array> | null {
    try {
      // Include applicationId in the request body
      const requestWithAppId = {
        ...request,
        applicationId: applicationId,
      };

      // Create a fetch request to the streaming endpoint
      const fetchPromise = fetch(`${this.baseUrl}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestWithAppId),
      });

      // Return the response body as a readable stream
      return new ReadableStream({
        async start(controller) {
          try {
            const response = await fetchPromise;

            if (!response.ok) {
              const errorText = await response.text();
              controller.error(
                new Error(
                  `API request failed: ${response.status} ${response.statusText} - ${errorText}`,
                ),
              );
              return;
            }

            if (!response.body) {
              controller.error(new Error('Response body is null'));
              return;
            }

            const reader = response.body.getReader();

            // Process the stream
            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                controller.close();
                break;
              }

              controller.enqueue(value);
            }
          } catch (error) {
            console.error('Stream processing error:', error);
            controller.error(error);
          }
        },
      });
    } catch (error) {
      console.error('Failed to initiate streaming chat:', error);
      return null;
    }
  }
}

// Export a singleton instance
export const qBusinessProxyChatService = QBusinessProxyChatService.getInstance();
