// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BedrockService } from '../services/bedrock.service';

@Controller('api/bedrock')
export class BedrockController {
  private readonly logger = new Logger(BedrockController.name);

  constructor(private readonly bedrockService: BedrockService) {}

  /**
   * Start a Bedrock evaluation job
   * @param request Request containing evaluation job parameters
   * @returns The response from the CreateEvaluationJob API
   */
  @Post('evaluations')
  async startEvaluation(
    @Body()
    request: {
      s3BucketName: string;
      inputFileKey: string;
      outputFolder: string;
      jobName: string;
      sessionId?: string;
    },
  ): Promise<any> {
    try {
      this.logger.log(`Starting evaluation job: ${request.jobName}`);

      if (!request.s3BucketName) {
        throw new HttpException(
          'S3 bucket name is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!request.inputFileKey) {
        throw new HttpException(
          'Input file key is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!request.outputFolder) {
        throw new HttpException(
          'Output folder is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!request.jobName) {
        throw new HttpException('Job name is required', HttpStatus.BAD_REQUEST);
      }

      return await this.bedrockService.startEvaluation(
        request.s3BucketName,
        request.inputFileKey,
        request.outputFolder,
        request.jobName,
        request.sessionId,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error starting evaluation job: ${error}`);
      throw new HttpException(
        `Failed to start evaluation job: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get the status and details of an evaluation job
   * @param jobId The ID of the evaluation job to check
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns The response from the GetEvaluationJob API
   */
  @Get('evaluations/status')
  async getEvaluationJobStatus(
    @Query('jobId') jobId: string,
    @Query('sessionId') sessionId?: string,
  ): Promise<any> {
    try {
      if (!jobId) {
        throw new HttpException('Job ID is required', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Getting evaluation job status for job ID: ${jobId}`);
      return await this.bedrockService.getEvaluationJobStatus(jobId, sessionId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error getting evaluation job status: ${error}`);
      throw new HttpException(
        `Failed to get evaluation job status: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * List all evaluation jobs
   * @param maxResults Maximum number of results to return
   * @param nextToken Token for pagination
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns The response from the ListEvaluationJobs API
   */
  @Get('evaluations')
  async listEvaluationJobs(
    @Query('maxResults') maxResults?: number,
    @Query('nextToken') nextToken?: string,
    @Query('sessionId') sessionId?: string,
  ): Promise<any> {
    try {
      this.logger.log('Listing evaluation jobs');
      return await this.bedrockService.listEvaluationJobs(
        maxResults ? parseInt(maxResults.toString(), 10) : undefined,
        nextToken,
        sessionId,
      );
    } catch (error) {
      this.logger.error(`Error listing evaluation jobs: ${error}`);
      throw new HttpException(
        `Failed to list evaluation jobs: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
