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
import { S3Service } from '../services/s3.service';

@Controller('api/s3')
export class S3Controller {
  private readonly logger = new Logger(S3Controller.name);

  constructor(private readonly s3Service: S3Service) {}

  /**
   * Upload a string to an S3 bucket
   * @param request Request containing upload parameters
   * @returns Response from S3 PutObject operation
   */
  @Post('upload')
  async uploadObject(
    @Body()
    request: {
      bucketName: string;
      key: string;
      content: string;
      contentType?: string;
      sessionId?: string;
    },
  ): Promise<any> {
    try {
      this.logger.log(
        `Uploading object to ${request.bucketName}/${request.key}`,
      );

      if (!request.bucketName) {
        throw new HttpException(
          'Bucket name is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!request.key) {
        throw new HttpException('Key is required', HttpStatus.BAD_REQUEST);
      }

      if (!request.content) {
        throw new HttpException('Content is required', HttpStatus.BAD_REQUEST);
      }

      return await this.s3Service.uploadObject(
        request.bucketName,
        request.key,
        request.content,
        request.contentType,
        request.sessionId,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error uploading object: ${error}`);
      throw new HttpException(
        `Failed to upload object: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Check if a bucket exists
   * @param bucketName The name of the S3 bucket to check
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns True if the bucket exists, False otherwise
   */
  @Get('bucket-exists')
  async bucketExists(
    @Query('bucketName') bucketName: string,
    @Query('sessionId') sessionId?: string,
  ): Promise<{ exists: boolean }> {
    try {
      if (!bucketName) {
        throw new HttpException(
          'Bucket name is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`Checking if bucket ${bucketName} exists`);
      const exists = await this.s3Service.bucketExists(bucketName, sessionId);
      return { exists };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error checking if bucket exists: ${error}`);
      throw new HttpException(
        `Failed to check if bucket exists: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create a new S3 bucket
   * @param request Request containing bucket creation parameters
   * @returns Response from S3 CreateBucket operation
   */
  @Post('create-bucket')
  async createBucket(
    @Body()
    request: {
      bucketName: string;
      region?: string;
      sessionId?: string;
    },
  ): Promise<any> {
    try {
      if (!request.bucketName) {
        throw new HttpException(
          'Bucket name is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`Creating bucket ${request.bucketName}`);
      return await this.s3Service.createBucket(
        request.bucketName,
        request.region,
        request.sessionId,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error creating bucket: ${error}`);
      throw new HttpException(
        `Failed to create bucket: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Set CORS policy on an S3 bucket
   * @param request Request containing CORS policy parameters
   * @returns Response from S3 PutBucketCors operation
   */
  @Post('set-cors')
  async setBucketCorsPolicy(
    @Body() request: { bucketName: string; sessionId?: string },
  ): Promise<any> {
    try {
      if (!request.bucketName) {
        throw new HttpException(
          'Bucket name is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`Setting CORS policy on bucket ${request.bucketName}`);
      return await this.s3Service.setBucketCorsPolicy(
        request.bucketName,
        request.sessionId,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error setting CORS policy: ${error}`);
      throw new HttpException(
        `Failed to set CORS policy: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Ensure a bucket exists with proper CORS configuration
   * @param request Request containing bucket parameters
   * @returns Status of the operation
   */
  @Post('ensure-bucket')
  async ensureBucketExists(
    @Body()
    request: {
      bucketName: string;
      region?: string;
      sessionId?: string;
    },
  ): Promise<any> {
    try {
      if (!request.bucketName) {
        throw new HttpException(
          'Bucket name is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`Ensuring bucket ${request.bucketName} exists`);
      return await this.s3Service.ensureBucketExists(
        request.bucketName,
        request.region,
        request.sessionId,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error ensuring bucket exists: ${error}`);
      throw new HttpException(
        `Failed to ensure bucket exists: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * List objects in a specific S3 bucket with optional prefix
   * @param bucketName The name of the S3 bucket
   * @param prefix Optional prefix to filter objects
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns List of objects with their properties
   */
  @Get('list-objects')
  async listObjects(
    @Query('bucketName') bucketName: string,
    @Query('prefix') prefix?: string,
    @Query('sessionId') sessionId?: string,
  ): Promise<any> {
    try {
      if (!bucketName) {
        throw new HttpException(
          'Bucket name is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`Listing objects in bucket ${bucketName}`);
      return await this.s3Service.listObjects(bucketName, prefix, sessionId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error listing objects: ${error}`);
      throw new HttpException(
        `Failed to list objects: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get an object from S3 without parsing (raw data)
   * @param bucketName The name of the S3 bucket
   * @param key The key (path) of the object to retrieve
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns The raw object content as a string
   */
  @Get('get-object')
  async getObject(
    @Query('bucketName') bucketName: string,
    @Query('key') key: string,
    @Query('sessionId') sessionId?: string,
  ): Promise<any> {
    try {
      if (!bucketName) {
        throw new HttpException(
          'Bucket name is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!key) {
        throw new HttpException(
          'Object key is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`Getting object ${key} from bucket ${bucketName}`);
      return await this.s3Service.getObject(bucketName, key, sessionId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error getting object: ${error}`);
      throw new HttpException(
        `Failed to get object: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get an object from S3 and parse it as JSON or JSONL
   * @param bucketName The name of the S3 bucket
   * @param key The key (path) of the object to retrieve
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns Parsed JSON data as an array of objects
   */
  @Get('get-object-json')
  async getObjectAsJson(
    @Query('bucketName') bucketName: string,
    @Query('key') key: string,
    @Query('sessionId') sessionId?: string,
  ): Promise<any> {
    try {
      if (!bucketName) {
        throw new HttpException(
          'Bucket name is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!key) {
        throw new HttpException(
          'Object key is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(
        `Getting object ${key} from bucket ${bucketName} as JSON`,
      );
      return await this.s3Service.getObjectAsJson(bucketName, key, sessionId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Error getting object as JSON: ${error}`);
      throw new HttpException(
        `Failed to get object as JSON: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
