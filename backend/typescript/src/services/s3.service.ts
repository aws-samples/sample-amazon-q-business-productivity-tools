// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketCorsCommand,
  BucketLocationConstraint,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import { getClientWithSessionAsync } from './aws-client.utils';
import { DynamoDBService } from './dynamodb.service';

// Load environment variables
dotenv.config();

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly region: string;

  constructor(private readonly dynamoDBService: DynamoDBService) {
    // Get region from environment variables or use default
    this.region = process.env.AWS_REGION || 'us-east-1';

    // Initialize AWS client for S3
    this.s3Client = new S3Client({ region: this.region });
  }

  /**
   * Get an S3 client, optionally using credentials from a session
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns A client for the S3 service
   */
  async getClient(sessionId?: string): Promise<S3Client> {
    return getClientWithSessionAsync<S3Client>(
      's3',
      this.region,
      this.s3Client,
      sessionId,
      undefined,
      this.dynamoDBService,
    );
  }

  /**
   * Upload a string to an S3 bucket
   * @param bucketName The name of the S3 bucket
   * @param key The key (path) where the object will be stored
   * @param content The string content to upload
   * @param contentType The content type of the object (default: 'application/json')
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns Response from S3 PutObject operation
   */
  async uploadObject(
    bucketName: string,
    key: string,
    content: string,
    contentType: string = 'application/json',
    sessionId?: string,
  ): Promise<any> {
    try {
      this.logger.log(`Attempting to upload to ${bucketName}/${key}`);

      const client = await this.getClient(sessionId);

      // First try with ACL setting
      try {
        this.logger.log('Attempting to upload with ACL setting...');

        // Create the PutObject command with the content and ACL
        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: content,
          ContentType: contentType,
          ACL: 'public-read', // Make the object publicly readable
        });

        const response = await client.send(command);

        this.logger.log('Successfully uploaded with ACL setting');
        return {
          status: 'success',
          message: `Successfully uploaded object to ${bucketName}/${key}`,
          response,
        };
      } catch (aclError) {
        this.logger.warn(
          `Upload with ACL failed: ${aclError}. Trying without ACL...`,
        );

        // If ACL setting fails, try without it
        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: content,
          ContentType: contentType,
        });

        const response = await client.send(command);

        this.logger.log('Successfully uploaded without ACL setting');
        return {
          status: 'success',
          message: `Successfully uploaded object to ${bucketName}/${key}`,
          response,
        };
      }
    } catch (error) {
      this.logger.error(
        `Error uploading object to ${bucketName}/${key}: ${error}`,
      );

      // Provide more detailed error information
      let errorMessage = 'Failed to upload object to S3.';

      if (error.name === 'AccessDenied') {
        errorMessage +=
          ' This is an access denied error. Please check your IAM permissions.';
      } else if (error.name === 'NoSuchBucket') {
        errorMessage += ' The specified bucket does not exist.';
      }

      return {
        status: 'error',
        message: errorMessage,
        error: error.toString(),
      };
    }
  }

  /**
   * Check if a bucket exists
   * @param bucketName The name of the S3 bucket to check
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns True if the bucket exists, False otherwise
   */
  async bucketExists(bucketName: string, sessionId?: string): Promise<boolean> {
    try {
      const client = await this.getClient(sessionId);

      const command = new HeadBucketCommand({
        Bucket: bucketName,
      });

      await client.send(command);
      this.logger.log(`Bucket ${bucketName} exists`);
      return true;
    } catch (error) {
      this.logger.log(
        `Bucket ${bucketName} does not exist or is not accessible: ${error}`,
      );
      return false;
    }
  }

  /**
   * Create a new S3 bucket
   * @param bucketName The name of the S3 bucket to create
   * @param region The AWS region to create the bucket in (default: 'us-east-1')
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns Response from S3 CreateBucket operation
   */
  async createBucket(
    bucketName: string,
    region: string = 'us-east-1',
    sessionId?: string,
  ): Promise<any> {
    try {
      // Check if the bucket already exists
      if (await this.bucketExists(bucketName, sessionId)) {
        this.logger.log(
          `Bucket ${bucketName} already exists, skipping creation`,
        );
        return {
          status: 'success',
          message: `Bucket ${bucketName} already exists`,
        };
      }

      this.logger.log(`Creating bucket ${bucketName} in region ${region}`);

      const client = await this.getClient(sessionId);

      // Create the bucket
      let command;
      if (region === 'us-east-1') {
        command = new CreateBucketCommand({
          Bucket: bucketName,
        });
      } else {
        command = new CreateBucketCommand({
          Bucket: bucketName,
          CreateBucketConfiguration: {
            LocationConstraint: region as BucketLocationConstraint,
          },
        });
      }

      const response = await client.send(command);

      this.logger.log(`Successfully created bucket ${bucketName}`);
      return {
        status: 'success',
        message: `Successfully created bucket ${bucketName}`,
        response,
      };
    } catch (error) {
      this.logger.error(`Error creating bucket ${bucketName}: ${error}`);
      return {
        status: 'error',
        message: `Failed to create bucket ${bucketName}`,
        error: error.toString(),
      };
    }
  }

  /**
   * Set CORS policy on an S3 bucket
   * @param bucketName The name of the S3 bucket to set CORS policy on
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns Response from S3 PutBucketCors operation
   */
  async setBucketCorsPolicy(
    bucketName: string,
    sessionId?: string,
  ): Promise<any> {
    try {
      this.logger.log(`Setting CORS policy on bucket ${bucketName}`);

      const client = await this.getClient(sessionId);

      // Set a permissive CORS policy for browser uploads
      const command = new PutBucketCorsCommand({
        Bucket: bucketName,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ['*'],
              AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
              AllowedOrigins: ['*'],
              ExposeHeaders: ['ETag'],
              MaxAgeSeconds: 3000,
            },
          ],
        },
      });

      const response = await client.send(command);

      this.logger.log(`Successfully set CORS policy on bucket ${bucketName}`);
      return {
        status: 'success',
        message: `Successfully set CORS policy on bucket ${bucketName}`,
        response,
      };
    } catch (error) {
      this.logger.error(
        `Error setting CORS policy on bucket ${bucketName}: ${error}`,
      );
      return {
        status: 'error',
        message: `Failed to set CORS policy on bucket ${bucketName}`,
        error: error.toString(),
      };
    }
  }

  /**
   * Ensure a bucket exists with proper CORS configuration
   * @param bucketName The name of the S3 bucket to ensure exists
   * @param region The AWS region to create the bucket in if it doesn't exist (default: 'us-east-1')
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns Status of the operation
   */
  async ensureBucketExists(
    bucketName: string,
    region: string = 'us-east-1',
    sessionId?: string,
  ): Promise<any> {
    try {
      this.logger.log(`Checking if bucket ${bucketName} exists...`);

      // Check if the bucket exists
      const exists = await this.bucketExists(bucketName, sessionId);

      // Create the bucket if it doesn't exist
      if (!exists) {
        this.logger.log(
          `Bucket ${bucketName} doesn't exist. Creating a new bucket...`,
        );
        const createResult = await this.createBucket(
          bucketName,
          region,
          sessionId,
        );

        if (createResult.status === 'error') {
          return createResult;
        }

        this.logger.log(`Successfully created bucket ${bucketName}`);
      }

      // Set CORS policy on the bucket
      this.logger.log(`Setting CORS policy on bucket ${bucketName}...`);
      const corsResult = await this.setBucketCorsPolicy(bucketName, sessionId);

      if (corsResult.status === 'error') {
        return corsResult;
      }

      this.logger.log(
        `Bucket ${bucketName} exists with proper CORS configuration`,
      );
      return {
        status: 'success',
        message: `Bucket ${bucketName} exists with proper CORS configuration`,
        bucketCreated: !exists,
      };
    } catch (error) {
      this.logger.error(`Error ensuring bucket ${bucketName} exists: ${error}`);
      return {
        status: 'error',
        message: `Failed to ensure bucket ${bucketName} exists`,
        error: error.toString(),
      };
    }
  }

  /**
   * List objects in a specific S3 bucket with optional prefix
   *
   * This method lists objects in an S3 bucket, handling pagination automatically.
   *
   * @param bucketName The name of the S3 bucket
   * @param prefix Optional prefix to filter objects (default: '')
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns If successful, returns a list of objects with their properties
   */
  async listObjects(
    bucketName: string,
    prefix: string = '',
    sessionId?: string,
  ): Promise<any> {
    try {
      this.logger.log(
        `Listing objects in bucket ${bucketName} with prefix '${prefix}'`,
      );

      const client = await this.getClient(sessionId);
      const objects: Array<{
        key: string;
        size: number;
        lastModified?: Date;
        etag?: string;
        storageClass?: string;
      }> = [];
      let continuationToken: string | undefined = undefined;

      // Paginate through all objects
      while (true) {
        // Prepare parameters for ListObjectsV2
        const params: any = {
          Bucket: bucketName,
          Prefix: prefix,
        };

        // Add continuation token if we have one
        if (continuationToken) {
          params.ContinuationToken = continuationToken;
        }

        // Call ListObjectsV2
        const command = new ListObjectsV2Command(params);
        const response = await client.send(command);

        // Process the contents
        if (response.Contents) {
          for (const item of response.Contents) {
            objects.push({
              key: item.Key || '',
              size: item.Size || 0,
              lastModified: item.LastModified,
              etag: item.ETag,
              storageClass: item.StorageClass as string,
            });
          }
        }

        // Check if there are more objects to fetch
        if (!response.IsTruncated) {
          break;
        }

        continuationToken = response.NextContinuationToken;
      }

      this.logger.log(
        `Successfully listed ${objects.length} objects from bucket ${bucketName}`,
      );
      return {
        status: 'success',
        message: `Successfully listed objects from bucket ${bucketName}`,
        objects,
      };
    } catch (error) {
      this.logger.error(
        `Error listing objects in bucket ${bucketName}: ${error}`,
      );
      return {
        status: 'error',
        message: 'Failed to list S3 objects. Please check your permissions.',
        error: error.toString(),
      };
    }
  }

  /**
   * Get an object from S3 without parsing (raw data)
   *
   * This method retrieves an object from an S3 bucket and returns the raw content
   *
   * @param bucketName The name of the S3 bucket
   * @param key The key (path) of the object to retrieve
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns The raw object content as a string
   */
  async getObject(
    bucketName: string,
    key: string,
    sessionId?: string,
  ): Promise<any> {
    try {
      this.logger.log(`Getting object ${key} from bucket ${bucketName}`);

      const client = await this.getClient(sessionId);

      // Get the object from S3
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const response = await client.send(command);

      // Read the content as a string
      const streamToString = async (stream: any): Promise<string> => {
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks).toString('utf-8');
      };

      const bodyContents = await streamToString(response.Body);

      this.logger.log(
        `Successfully retrieved object ${key} from bucket ${bucketName}`,
      );
      return {
        status: 'success',
        message: `Successfully retrieved object from ${bucketName}/${key}`,
        content: bodyContents,
        contentType: response.ContentType,
        lastModified: response.LastModified,
        contentLength: response.ContentLength,
      };
    } catch (error) {
      this.logger.error(
        `Error getting object ${key} from bucket ${bucketName}: ${error}`,
      );
      return {
        status: 'error',
        message: 'Failed to get S3 object. Please check your permissions.',
        error: error.toString(),
      };
    }
  }

  /**
   * Get an object from S3 and parse it as JSON or JSONL
   *
   * This method retrieves an object from an S3 bucket and attempts to parse it as:
   * 1. A JSON array if the content starts with '[' and ends with ']'
   * 2. JSONL (JSON Lines) format where each line is a separate JSON object
   *
   * @param bucketName The name of the S3 bucket
   * @param key The key (path) of the object to retrieve
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns If successful, returns the parsed JSON data as an array of objects
   */
  async getObjectAsJson(
    bucketName: string,
    key: string,
    sessionId?: string,
  ): Promise<any> {
    try {
      this.logger.log(`Getting object ${key} from bucket ${bucketName}`);

      const client = await this.getClient(sessionId);

      // Get the object from S3
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const response = await client.send(command);

      // Read the content as a string
      const streamToString = async (stream: any): Promise<string> => {
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks).toString('utf-8');
      };

      const bodyContents = await streamToString(response.Body);

      // Check if the content is a JSON array
      if (
        bodyContents.trim().startsWith('[') &&
        bodyContents.trim().endsWith(']')
      ) {
        this.logger.log('Parsing content as JSON array');
        return JSON.parse(bodyContents);
      }

      // Parse JSONL (each line is a JSON object)
      this.logger.log('Parsing content as JSONL');
      const results: any[] = [];
      const lines = bodyContents.split('\n');

      for (const line of lines) {
        if (line.trim()) {
          // Skip empty lines
          try {
            results.push(JSON.parse(line));
          } catch (e) {
            this.logger.warn(`Failed to parse JSON line: ${line}`);
            // Skip invalid JSON lines
          }
        }
      }

      this.logger.log(
        `Successfully parsed ${results.length} JSON objects from ${key}`,
      );
      return results;
    } catch (error) {
      this.logger.error(
        `Error getting object ${key} from bucket ${bucketName}: ${error}`,
      );
      return {
        status: 'error',
        message: 'Failed to get S3 object. Please check your permissions.',
        error: error.toString(),
      };
    }
  }
}
