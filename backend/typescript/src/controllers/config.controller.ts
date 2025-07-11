// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import {
  Controller,
  Get,
  Query,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '../services/config.service';

@Controller('api/config')
export class ConfigController {
  private readonly logger = new Logger(ConfigController.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Get Cognito configuration from AWS Secrets Manager
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns Cognito configuration values
   */
  @Get('cognito')
  async getCognitoConfig(
    @Query('session_id') sessionId?: string,
  ): Promise<any> {
    try {
      this.logger.log('Getting Cognito configuration');

      const result = await this.configService.getCognitoConfig(sessionId);

      if (result.status === 'error') {
        throw new HttpException(
          result.message || 'Failed to retrieve Cognito configuration',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error getting Cognito configuration: ${error}`);
      throw new HttpException(
        `Failed to retrieve Cognito configuration: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
