// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import {
  Controller,
  Post,
  Body,
  Res,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { QBusinessStreamingChatService } from '../services/qbusiness-streaming-chat.service';

@Controller('api/chat')
export class QBusinessStreamingChatController {
  private readonly logger = new Logger(QBusinessStreamingChatController.name);

  constructor(
    private readonly qbusinessStreamingChatService: QBusinessStreamingChatService,
  ) {}

  /**
   * Chat with Q Business AI using the Chat API with streaming response
   * @param request Request containing chat parameters
   * @param res Express response object for SSE
   */
  @Post('stream')
  async chatStream(
    @Body()
    request: {
      applicationId: string;
      message: string;
      conversationId?: string;
      systemMessageId?: string;
      attributeFilter?: any;
      selectedPlugin?: string;
      actionExecution?: any;
      sessionId?: string;
    },
    @Res() res: Response,
  ): Promise<void> {
    try {
      this.logger.log(
        `Received chat stream request for application ${request.applicationId}`,
      );

      if (!request.applicationId) {
        throw new HttpException(
          'Application ID is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!request.message) {
        throw new HttpException('Message is required', HttpStatus.BAD_REQUEST);
      }

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering

      // Pass the response object directly to the service to handle streaming
      await this.qbusinessStreamingChatService.chatStream(
        request.applicationId,
        request.message,
        res,
        request.conversationId,
        request.systemMessageId,
        request.attributeFilter,
        request.selectedPlugin,
        request.actionExecution,
        request.sessionId,
      );

      // The service will handle writing to the response and ending it
      // No need to subscribe to an Observable anymore
    } catch (error) {
      this.logger.error(`Error setting up chat stream: ${error}`);

      // If headers haven't been sent yet, send an error response
      if (!res.headersSent) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          status: 'error',
          message: `Failed to set up chat stream: ${error.message}`,
        });
      } else {
        // Otherwise, send an error event and end the stream
        res.write(
          `data: ${JSON.stringify({
            type: 'error',
            message:
              error.message ||
              'An error occurred while setting up the chat stream',
          })}\n\n`,
        );
        res.end();
      }
    }
  }
}
