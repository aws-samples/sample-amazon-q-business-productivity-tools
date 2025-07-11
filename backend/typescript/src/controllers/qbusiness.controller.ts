// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { QBusinessService } from '../services/qbusiness.service';

@Controller('api')
export class QBusinessController {
  private readonly logger = new Logger(QBusinessController.name);

  constructor(private readonly qbusinessService: QBusinessService) {}

  @Get('health')
  healthCheck() {
    return { status: 'healthy' };
  }

  @Get('applications')
  async listApplications() {
    try {
      const applications = await this.qbusinessService.listApplications();
      return { applications };
    } catch (error) {
      this.logger.error(`Failed to list applications: ${error}`);
      throw new HttpException(
        `Failed to list applications: ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('applications/:applicationId/indices')
  async listIndices(@Param('applicationId') applicationId: string) {
    try {
      const indices = await this.qbusinessService.listIndices(applicationId);
      return { indices };
    } catch (error) {
      this.logger.error(`Failed to list indices: ${error}`);
      throw new HttpException(
        `Failed to list indices: ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('applications/:applicationId/plugins')
  async listPlugins(@Param('applicationId') applicationId: string) {
    try {
      const plugins = await this.qbusinessService.listPlugins(applicationId);
      return { plugins };
    } catch (error) {
      this.logger.error(`Failed to list plugins: ${error}`);
      throw new HttpException(
        `Failed to list plugins: ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('applications/:applicationId/indices/:indexId/datasources')
  async listDataSources(
    @Param('applicationId') applicationId: string,
    @Param('indexId') indexId: string,
  ) {
    try {
      const dataSources = await this.qbusinessService.listDataSources(
        applicationId,
        indexId,
      );
      return { dataSources };
    } catch (error) {
      this.logger.error(`Failed to list data sources: ${error}`);
      throw new HttpException(
        `Failed to list data sources: ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(
    'applications/:applicationId/indices/:indexId/datasources/:dataSourceId/syncjobs',
  )
  async listDataSourceSyncJobs(
    @Param('applicationId') applicationId: string,
    @Param('indexId') indexId: string,
    @Param('dataSourceId') dataSourceId: string,
  ) {
    try {
      const syncJobs = await this.qbusinessService.listDataSourceSyncJobs(
        applicationId,
        indexId,
        dataSourceId,
      );
      return { syncJobs };
    } catch (error) {
      this.logger.error(`Failed to list sync jobs: ${error}`);
      throw new HttpException(
        `Failed to list sync jobs: ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(
    'applications/:applicationId/indices/:indexId/datasources/:dataSourceId/syncjobs/:syncJobId/metrics',
  )
  async getSyncJobMetrics(
    @Param('applicationId') applicationId: string,
    @Param('indexId') indexId: string,
    @Param('dataSourceId') dataSourceId: string,
    @Param('syncJobId') syncJobId: string,
  ) {
    try {
      const metrics = await this.qbusinessService.getSyncJobMetrics(
        applicationId,
        indexId,
        dataSourceId,
        syncJobId,
      );
      return metrics;
    } catch (error) {
      this.logger.error(`Failed to get sync job metrics: ${error}`);
      throw new HttpException(
        `Failed to get sync job metrics: ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('applications/:applicationId/search')
  async searchRelevantContent(
    @Param('applicationId') applicationId: string,
    @Query('query') query: string,
    @Query('retriever_id') retrieverId: string,
    @Query('max_results') maxResultsStr: string = '5',
    @Query('next_token') nextToken?: string,
    @Query('session_id') sessionId?: string,
  ) {
    try {
      if (!query) {
        throw new HttpException('query is required', HttpStatus.BAD_REQUEST);
      }
      if (!retrieverId) {
        throw new HttpException(
          'retriever_id is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Parse maxResults as an integer
      const maxResults = parseInt(maxResultsStr, 10);
      if (isNaN(maxResults)) {
        throw new HttpException(
          'max_results must be a valid number',
          HttpStatus.BAD_REQUEST,
        );
      }

      const results = await this.qbusinessService.searchRelevantContent(
        applicationId,
        retrieverId,
        query,
        maxResults,
        nextToken,
        sessionId,
      );

      return results;
    } catch (error) {
      this.logger.error(`Failed to search relevant content: ${error}`);
      throw new HttpException(
        `Failed to search relevant content: ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('applications/:applicationId/check-access')
  async checkDocumentAccess(
    @Param('applicationId') applicationId: string,
    @Body()
    requestData: {
      indexId: string;
      dataSourceId: string;
      documentId: string;
      userId: string;
      sessionId?: string;
    },
  ) {
    try {
      const { indexId, dataSourceId, documentId, userId, sessionId } =
        requestData;

      // Validate required parameters
      if (!indexId) {
        throw new HttpException('indexId is required', HttpStatus.BAD_REQUEST);
      }
      if (!dataSourceId) {
        throw new HttpException(
          'dataSourceId is required',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (!documentId) {
        throw new HttpException(
          'documentId is required',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (!userId) {
        throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
      }

      const response = await this.qbusinessService.checkAccess(
        applicationId,
        indexId,
        dataSourceId,
        documentId,
        userId,
        sessionId,
      );

      return response;
    } catch (error) {
      this.logger.error(`Failed to check document access: ${error}`);
      throw new HttpException(
        `Failed to check document access: ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
