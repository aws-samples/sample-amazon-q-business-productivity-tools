// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { API_BASE_URL } from '../../constants/apiConstants';
import { ServiceResult } from '../service.types';

/**
 * BedrockProxyService - A service to proxy Bedrock operations to the backend API
 */
export class BedrockProxyService {
  private static instance: BedrockProxyService;
  private apiClient: any;
  private baseUrl: string;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    // Get the base URL from constants
    this.baseUrl = API_BASE_URL;

    // Create fetch-based API client
    this.apiClient = {
      get: async (url: string, params?: Record<string, string>) => {
        try {
          // Build URL with query parameters if provided
          let fullUrl = `${this.baseUrl}${url}`;
          if (params) {
            const queryParams = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
              if (value !== undefined && value !== null) {
                queryParams.append(key, value);
              }
            });
            const queryString = queryParams.toString();
            if (queryString) {
              fullUrl += `?${queryString}`;
            }
          }

          const response = await fetch(fullUrl, {
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
              status: response.status,
              statusText: response.statusText,
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
   * Get singleton instance of BedrockProxyService
   */
  public static getInstance(): BedrockProxyService {
    if (!BedrockProxyService.instance) {
      BedrockProxyService.instance = new BedrockProxyService();
    }
    return BedrockProxyService.instance;
  }

  /**
   * Start a Bedrock evaluation job
   *
   * @param s3BucketName The S3 bucket name
   * @param inputFileKey The key of the input file in the S3 bucket
   * @param outputFolder The folder in the S3 bucket to store output
   * @param jobName The name of the evaluation job
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns ServiceResult with the response from the CreateEvaluationJob API
   */
  public async startEvaluation(
    s3BucketName: string,
    inputFileKey: string,
    outputFolder: string,
    jobName: string,
    sessionId?: string,
  ): Promise<ServiceResult<any>> {
    try {
      const response = await this.apiClient.post('/api/bedrock/evaluations', {
        s3BucketName: s3BucketName,
        inputFileKey: inputFileKey,
        outputFolder: outputFolder,
        jobName: jobName,
        sessionId: sessionId,
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error(`Error starting Bedrock evaluation job via proxy service:`, error);

      // Provide more detailed error information
      let errorMessage = 'Failed to start Bedrock evaluation job.';
      const statusCode = error.response?.status || 500;

      if (error.response?.statusText) {
        errorMessage += ` Error: ${error.response.statusText}`;
      }

      return {
        success: false,
        error: {
          code: 'StartEvaluationFailed',
          message: errorMessage,
          statusCode: statusCode,
        },
      };
    }
  }

  /**
   * List all Bedrock evaluation jobs
   *
   * @param maxResults Maximum number of results to return (default: 10)
   * @param nextToken Token for pagination
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns ServiceResult with the response from the ListEvaluationJobs API
   */
  public async listEvaluationJobs(
    maxResults = 10,
    nextToken?: string,
    sessionId?: string,
  ): Promise<ServiceResult<any>> {
    try {
      console.log(`Listing Bedrock evaluation jobs via proxy service`);

      const params: Record<string, string> = {};
      if (maxResults) params.maxResults = maxResults.toString();
      if (nextToken) params.nextToken = nextToken;
      if (sessionId) params.sessionId = sessionId;

      const response = await this.apiClient.get('/api/bedrock/evaluations', params);

      console.log(`Successfully listed Bedrock evaluation jobs via proxy service`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error(`Error listing Bedrock evaluation jobs via proxy service:`, error);

      // Provide more detailed error information
      let errorMessage = 'Failed to list Bedrock evaluation jobs.';
      const statusCode = error.response?.status || 500;

      if (error.response?.statusText) {
        errorMessage += ` Error: ${error.response.statusText}`;
      }

      return {
        success: false,
        error: {
          code: 'ListEvaluationJobsFailed',
          message: errorMessage,
          statusCode: statusCode,
        },
      };
    }
  }

  /**
   * Get the status and details of a Bedrock evaluation job
   *
   * @param jobId The ID of the evaluation job to check
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns ServiceResult with the response from the GetEvaluationJob API
   */
  public async getEvaluationJobStatus(
    jobId: string,
    sessionId?: string,
  ): Promise<ServiceResult<any>> {
    try {
      console.log(`Getting Bedrock evaluation job status via proxy service`);

      const params: Record<string, string> = {};
      if (sessionId) params.sessionId = sessionId;

      // Add jobId as a query parameter instead of a path parameter
      params.jobId = jobId;
      const response = await this.apiClient.get('/api/bedrock/evaluations/status', params);

      console.log(`Successfully got Bedrock evaluation job status via proxy service`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error(`Error getting Bedrock evaluation job status via proxy service:`, error);

      // Provide more detailed error information
      let errorMessage = 'Failed to get Bedrock evaluation job status.';
      const statusCode = error.response?.status || 500;

      if (error.response?.statusText) {
        errorMessage += ` Error: ${error.response.statusText}`;
      }

      return {
        success: false,
        error: {
          code: 'GetEvaluationJobStatusFailed',
          message: errorMessage,
          statusCode: statusCode,
        },
      };
    }
  }
}

// Export a singleton instance
export const bedrockProxyService = BedrockProxyService.getInstance();
