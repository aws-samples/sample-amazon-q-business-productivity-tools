// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { API_BASE_URL } from '../../constants/apiConstants';
import { ServiceResult } from '../service.types';
/* eslint no-use-before-define: 0 */
/**
 * S3ProxyService - A service to proxy S3 operations to the backend API
 */
export class S3ProxyService {
  private static instance: S3ProxyService;
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
      get: async (url: string) => {
        try {
          const response = await fetch(`${this.baseUrl}${url}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
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
   * Get singleton instance of S3ProxyService
   */
  public static getInstance(): S3ProxyService {
    if (!S3ProxyService.instance) {
      S3ProxyService.instance = new S3ProxyService();
    }
    return S3ProxyService.instance;
  }

  /**
   * Upload a string to an S3 bucket
   *
   * @param bucketName The name of the S3 bucket
   * @param key The key (path) where the object will be stored
   * @param content The string content to upload
   * @param contentType The content type of the object (default: 'application/json')
   * @returns ServiceResult with upload status
   */
  public async uploadObject(
    bucketName: string,
    key: string,
    content: string,
    contentType = 'application/json',
  ): Promise<ServiceResult<any>> {
    try {
      const response = await this.apiClient.post('/api/s3/upload', {
        bucketName: bucketName,
        key: key,
        content: content,
        contentType: contentType,
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error(`Error uploading object to ${bucketName}/${key} via proxy service:`, error);

      // Provide more detailed error information
      let errorMessage = 'Failed to upload object to S3.';
      const statusCode = error.response?.status || 500;

      if (error.response?.statusText) {
        errorMessage += ` Error: ${error.response.statusText}`;
      }

      return {
        success: false,
        error: {
          code: 'UploadObjectFailed',
          message: errorMessage,
          statusCode: statusCode,
        },
      };
    }
  }

  /**
   * Ensure a bucket exists with proper CORS configuration
   *
   * @param bucketName The name of the S3 bucket to ensure exists
   * @param region The AWS region to create the bucket in if it doesn't exist (default: 'us-east-1')
   * @returns ServiceResult with operation status
   */
  public async ensureBucketExists(
    bucketName: string,
    region = 'us-east-1',
  ): Promise<ServiceResult<any>> {
    try {
      console.log(`Checking if bucket ${bucketName} exists via proxy service...`);

      const response = await this.apiClient.post('/api/s3/ensure-bucket', {
        bucketName: bucketName,
        region: region,
      });

      console.log(`Bucket ${bucketName} exists with proper CORS configuration via proxy service`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error(`Error ensuring bucket ${bucketName} exists via proxy service:`, error);

      // Provide more detailed error information
      let errorMessage = `Failed to ensure bucket ${bucketName} exists.`;
      const statusCode = error.response?.status || 500;

      if (error.response?.statusText) {
        errorMessage += ` Error: ${error.response.statusText}`;
      }

      return {
        success: false,
        error: {
          code: 'EnsureBucketExistsFailed',
          message: errorMessage,
          statusCode: statusCode,
        },
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
   * @returns ServiceResult with a list of objects and their properties
   */
  public async listObjects(
    bucketName: string,
    prefix = '',
    sessionId?: string,
  ): Promise<ServiceResult<any>> {
    try {
      // Build the query parameters
      const params = new URLSearchParams({
        bucketName: bucketName,
      });

      // Add prefix if it's not empty
      if (prefix) {
        params.append('prefix', prefix);
      }

      // Add optional sessionId if provided
      if (sessionId) {
        params.append('sessionId', sessionId);
      }

      const response = await this.apiClient.get(`/api/s3/list-objects?${params.toString()}`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error(`Error listing objects in bucket ${bucketName} via proxy service:`, error);

      // Provide more detailed error information
      let errorMessage = `Failed to list S3 objects from bucket ${bucketName}.`;
      const statusCode = error.response?.status || 500;

      if (error.response?.statusText) {
        errorMessage += ` Error: ${error.response.statusText}`;
      }

      return {
        success: false,
        error: {
          code: 'ListObjectsFailed',
          message: errorMessage,
          statusCode: statusCode,
        },
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
   * @returns ServiceResult with the parsed JSON data or error information
   */
  public async getObject2(
    bucketName: string,
    key: string,
    sessionId?: string,
  ): Promise<ServiceResult<any>> {
    try {
      console.log(`Getting object ${key} from bucket ${bucketName} via proxy service`);

      // Build the query parameters
      const params = new URLSearchParams({
        bucketName: bucketName,
        key: key,
      });

      // Add optional sessionId if provided
      if (sessionId) {
        params.append('sessionId', sessionId);
      }

      const response = await this.apiClient.get(`/api/s3/get-object-json?${params.toString()}`);

      console.log(`Successfully retrieved and parsed object ${key} from bucket ${bucketName}`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error(
        `Error getting object ${key} from bucket ${bucketName} via proxy service:`,
        error,
      );

      // Provide more detailed error information
      let errorMessage = `Failed to get S3 object ${key} from bucket ${bucketName}.`;
      const statusCode = error.response?.status || 500;

      if (error.response?.statusText) {
        errorMessage += ` Error: ${error.response.statusText}`;
      }

      return {
        success: false,
        error: {
          code: 'GetObjectFailed',
          message: errorMessage,
          statusCode: statusCode,
        },
      };
    }
  }
}

// Export a singleton instance
export const s3ProxyService = S3ProxyService.getInstance();
