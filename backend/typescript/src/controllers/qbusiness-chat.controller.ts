// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  QBusinessChatService,
  ChatMessage,
  ChatResponse,
} from '../services/qbusiness-chat.service';

interface ChatSyncRequest {
  applicationId: string;
  messages: ChatMessage[];
  conversationId?: string;
  systemMessageId?: string;
  attributeFilter?: any;
  selectedPlugin?: string;
  actionExecution?: any;
  sessionId?: string;
}

@Controller('api/chat')
export class QBusinessChatController {
  private readonly logger = new Logger(QBusinessChatController.name);

  constructor(private readonly qbusinessChatService: QBusinessChatService) {}

  /**
   * Chat with Q Business AI using the ChatSync API
   * @param request Request containing chat parameters
   * @returns Chat response with message and citations
   */
  @Post('sync')
  async chatSync(@Body() request: ChatSyncRequest): Promise<ChatResponse> {
    try {
      this.logger.log(
        `Received chat sync request for application ${request.applicationId}`,
      );

      if (!request.applicationId) {
        throw new HttpException(
          'Application ID is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!request.messages || request.messages.length === 0) {
        throw new HttpException(
          'At least one message is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      return await this.qbusinessChatService.chatSync(
        request.applicationId,
        request.messages,
        request.conversationId,
        request.systemMessageId,
        request.attributeFilter,
        request.selectedPlugin,
        request.actionExecution,
        request.sessionId,
      );
    } catch (error) {
      this.logger.error(`Error in chat sync: ${error}`);
      throw new HttpException(
        `Failed to get AI response: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
