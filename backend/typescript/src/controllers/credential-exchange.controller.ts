// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  CredentialExchangeService,
  SessionInfo,
} from '../services/credential-exchange.service';

interface TokenExchangeRequest {
  idToken: string;
}

interface AnonymousAccessRequest {
  roleArn?: string;
}

@Controller('api/credentials')
export class CredentialExchangeController {
  private readonly logger = new Logger(CredentialExchangeController.name);

  constructor(
    private readonly credentialExchangeService: CredentialExchangeService,
  ) {}

  /**
   * Exchange an ID token for AWS credentials
   * @param request Request containing the ID token
   * @returns Session information including sessionId and credentials
   */
  @Post('exchange')
  async exchange(@Body() request: TokenExchangeRequest): Promise<SessionInfo> {
    try {
      this.logger.log('Received request to exchange ID token for credentials');

      if (!request.idToken) {
        throw new HttpException('ID token is required', HttpStatus.BAD_REQUEST);
      }

      return await this.credentialExchangeService.exchange(request.idToken);
    } catch (error) {
      this.logger.error(`Error exchanging token: ${error}`);
      throw new HttpException(
        `Failed to exchange token: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Exchange for anonymous access
   * @param request Request containing optional role ARN
   * @returns Session information including sessionId and credentials
   */
  @Post('anonymous')
  async anonymousAccess(
    @Body() request: AnonymousAccessRequest,
  ): Promise<SessionInfo> {
    try {
      this.logger.log('Received request for anonymous access');

      return await this.credentialExchangeService.exchangeForAnonymousAccess(
        request.roleArn,
      );
    } catch (error) {
      this.logger.error(`Error getting anonymous access: ${error}`);
      throw new HttpException(
        `Failed to get anonymous access: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get session information by session ID
   * @param sessionId The session ID
   * @returns Session information
   */
  @Get('session/:sessionId')
  async getSession(
    @Param('sessionId') sessionId: string,
  ): Promise<SessionInfo> {
    try {
      this.logger.log(`Received request to get session: ${sessionId}`);

      const session =
        await this.credentialExchangeService.getSession(sessionId);

      if (!session) {
        throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
      }

      return session;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error getting session: ${error}`);
      throw new HttpException(
        `Failed to get session: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Check if a session is valid
   * @param sessionId The session ID
   * @returns Object indicating if the session is valid
   */
  @Get('validate/:sessionId')
  async validateSession(
    @Param('sessionId') sessionId: string,
  ): Promise<{ valid: boolean }> {
    try {
      this.logger.log(`Received request to validate session: ${sessionId}`);

      const isValid =
        await this.credentialExchangeService.isSessionValid(sessionId);

      return { valid: isValid };
    } catch (error) {
      this.logger.error(`Error validating session: ${error}`);
      throw new HttpException(
        `Failed to validate session: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get credentials from a session
   * @param sessionId The session ID
   * @returns Credentials
   */
  @Get('credentials/:sessionId')
  async getCredentials(@Param('sessionId') sessionId: string): Promise<any> {
    try {
      this.logger.log(
        `Received request to get credentials for session: ${sessionId}`,
      );

      const credentials =
        await this.credentialExchangeService.getCredentials(sessionId);

      if (!credentials) {
        throw new HttpException('Credentials not found', HttpStatus.NOT_FOUND);
      }

      return credentials;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error getting credentials: ${error}`);
      throw new HttpException(
        `Failed to get credentials: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
