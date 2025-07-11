// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  CloudWatchService,
  LogGroup,
  LogStream,
  LogEvent,
  Group,
  AclDocument,
} from '../services/cloudwatch.service';

@Controller('api/cloudwatch')
export class CloudWatchController {
  private readonly logger = new Logger(CloudWatchController.name);

  constructor(private readonly cloudwatchService: CloudWatchService) {}

  /**
   * List CloudWatch log groups with pagination
   * @param prefix Filter log groups by prefix
   * @param limit Maximum number of log groups to return
   * @param nextToken Token for pagination
   * @param sessionId Session ID for credentials
   * @returns Response containing log groups and next token
   */
  @Get('log-groups')
  async listLogGroups(
    @Query('prefix') prefix?: string,
    @Query('limit') limit?: number,
    @Query('nextToken') nextToken?: string,
    @Query('sessionId') sessionId?: string,
  ): Promise<{ logGroups: LogGroup[]; nextToken?: string }> {
    try {
      this.logger.log(`Listing log groups with prefix: ${prefix}`);
      return await this.cloudwatchService.listLogGroups(
        prefix,
        limit ? parseInt(limit.toString(), 10) : undefined,
        nextToken,
        sessionId,
      );
    } catch (error) {
      this.logger.error(`Error listing log groups: ${error}`);
      throw new HttpException(
        `Failed to list CloudWatch log groups: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * List CloudWatch log streams for a specific log group with pagination
   * @param logGroupName The name of the log group
   * @param prefix Filter log streams by prefix
   * @param orderBy Order streams by 'LogStreamName' or 'LastEventTime'
   * @param descending Sort in descending order if true
   * @param limit Maximum number of log streams to return
   * @param nextToken Token for pagination
   * @param sessionId Session ID for credentials
   * @returns Response containing log streams and next token
   */
  @Get('log-streams')
  async listLogStreams(
    @Query('logGroupName') logGroupName: string,
    @Query('prefix') prefix?: string,
    @Query('orderBy') orderBy?: string,
    @Query('descending') descending?: boolean,
    @Query('limit') limit?: number,
    @Query('nextToken') nextToken?: string,
    @Query('sessionId') sessionId?: string,
  ): Promise<{ logStreams: LogStream[]; nextToken?: string }> {
    try {
      if (!logGroupName) {
        throw new HttpException(
          'Log group name is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`Listing log streams for log group: ${logGroupName}`);
      return await this.cloudwatchService.listLogStreams(
        logGroupName,
        prefix,
        orderBy,
        descending !== undefined ? descending : true,
        limit ? parseInt(limit.toString(), 10) : undefined,
        nextToken,
        sessionId,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error listing log streams: ${error}`);
      throw new HttpException(
        `Failed to list CloudWatch log streams: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get log events from a specific log stream with pagination
   * @param logGroupName The name of the log group
   * @param logStreamName The name of the log stream
   * @param startTime Start time in milliseconds
   * @param endTime End time in milliseconds
   * @param limit Maximum number of log events to return
   * @param startFromHead If true, read from oldest to newest
   * @param nextToken Token for pagination
   * @param sessionId Session ID for credentials
   * @returns Response containing log events and next tokens
   */
  @Get('log-events')
  async getLogEvents(
    @Query('logGroupName') logGroupName: string,
    @Query('logStreamName') logStreamName: string,
    @Query('startTime') startTime?: number,
    @Query('endTime') endTime?: number,
    @Query('limit') limit?: number,
    @Query('startFromHead') startFromHead?: boolean,
    @Query('nextToken') nextToken?: string,
    @Query('sessionId') sessionId?: string,
  ): Promise<{
    logEvents: LogEvent[];
    nextForwardToken?: string;
    nextBackwardToken?: string;
  }> {
    try {
      if (!logGroupName) {
        throw new HttpException(
          'Log group name is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!logStreamName) {
        throw new HttpException(
          'Log stream name is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(
        `Getting log events for log group: ${logGroupName}, log stream: ${logStreamName}`,
      );
      return await this.cloudwatchService.getLogEvents(
        logGroupName,
        logStreamName,
        startTime,
        endTime,
        limit ? parseInt(limit.toString(), 10) : undefined,
        startFromHead !== undefined ? startFromHead : true,
        nextToken,
        sessionId,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error getting log events: ${error}`);
      throw new HttpException(
        `Failed to get CloudWatch log events: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Execute a CloudWatch Logs Insights query
   * @param request Request containing query parameters
   * @returns Query results and metadata
   */
  @Post('query')
  async executeQuery(
    @Body()
    request: {
      logGroupNames: string[];
      queryString: string;
      startTime: number;
      endTime: number;
      limit?: number;
      sessionId?: string;
    },
  ): Promise<{
    queryId: string;
    status: string;
    results: any[];
    statistics: any;
  }> {
    try {
      if (!request.logGroupNames || request.logGroupNames.length === 0) {
        throw new HttpException(
          'Log group names are required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!request.queryString) {
        throw new HttpException(
          'Query string is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!request.startTime) {
        throw new HttpException(
          'Start time is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!request.endTime) {
        throw new HttpException('End time is required', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(
        `Executing CloudWatch Logs Insights query: ${request.queryString}`,
      );
      return await this.cloudwatchService.executeQuery(
        request.logGroupNames,
        request.queryString,
        request.startTime,
        request.endTime,
        request.limit,
        request.sessionId,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error executing query: ${error}`);
      throw new HttpException(
        `Failed to execute CloudWatch Logs Insights query: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Fetch group membership information from CloudWatch logs
   * @param request Request containing configuration with application and sync job details
   * @returns List of groups with members
   */
  @Post('group-membership')
  async fetchGroupMembership(
    @Body() request: { config: any; sessionId?: string },
  ): Promise<Group[]> {
    try {
      if (!request.config) {
        throw new HttpException(
          'Configuration is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!request.config.applicationId) {
        throw new HttpException(
          'Application ID is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!request.config.dataSourceId) {
        throw new HttpException(
          'Data source ID is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!request.config.syncJobId && !request.config.syncJobExecutionId) {
        throw new HttpException(
          'Sync job ID is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(
        `Fetching group membership for application: ${request.config.applicationId}`,
      );
      return await this.cloudwatchService.fetchGroupMembership(
        request.config,
        request.sessionId,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error fetching group membership: ${error}`);
      throw new HttpException(
        `Failed to fetch group membership: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Fetch ACL documents from CloudWatch logs
   * @param request Request containing configuration with application and sync job details
   * @returns List of documents with ACL information
   */
  @Post('acl-documents')
  async fetchAclDocuments(
    @Body() request: { config: any; sessionId?: string },
  ): Promise<AclDocument[]> {
    try {
      if (!request.config) {
        throw new HttpException(
          'Configuration is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!request.config.dataSourceId) {
        throw new HttpException(
          'Data source ID is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!request.config.syncJobId) {
        throw new HttpException(
          'Sync job ID is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!request.config.applicationId && !request.config.indexId) {
        throw new HttpException(
          'Either application ID or index ID is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(
        `Fetching ACL documents for data source: ${request.config.dataSourceId}`,
      );
      return await this.cloudwatchService.fetchAclDocuments(
        request.config,
        request.sessionId,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error fetching ACL documents: ${error}`);
      throw new HttpException(
        `Failed to fetch ACL documents: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Fetch sync errors from CloudWatch logs
   * @param request Request containing configuration with application and sync job details
   * @returns List of sync errors
   */
  @Post('sync-errors')
  async fetchSyncErrors(
    @Body() request: { config: any; sessionId?: string },
  ): Promise<any[]> {
    try {
      if (!request.config) {
        throw new HttpException(
          'Configuration is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!request.config.dataSourceId) {
        throw new HttpException(
          'Data source ID is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!request.config.applicationId && !request.config.indexId) {
        throw new HttpException(
          'Either application ID or index ID is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(
        `Fetching sync errors for data source: ${request.config.dataSourceId}`,
      );
      return await this.cloudwatchService.fetchSyncErrors(
        request.config,
        request.sessionId,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error fetching sync errors: ${error}`);
      throw new HttpException(
        `Failed to fetch sync errors: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Validate AWS configuration
   * @param sessionId Session ID for credentials
   * @returns True if configuration is valid, False otherwise
   */
  @Get('validate')
  async validateConfiguration(
    @Query('sessionId') sessionId?: string,
  ): Promise<{ valid: boolean }> {
    try {
      this.logger.log('Validating AWS CloudWatch configuration');
      const valid =
        await this.cloudwatchService.validateConfiguration(sessionId);
      return { valid };
    } catch (error) {
      this.logger.error(`Error validating configuration: ${error}`);
      throw new HttpException(
        `Failed to validate AWS CloudWatch configuration: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
