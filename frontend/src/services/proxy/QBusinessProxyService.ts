// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { DocumentAttribute } from '@aws-sdk/client-qbusiness';

import { API_BASE_URL } from '../../constants/apiConstants';
import { AccessCheckResponse, Config } from '../../types/types';
import { ServiceResult } from '../service.types';

export interface SearchResult {
  documentId: string;
  documentTitle: string;
  documentUri?: string;
  documentExcerpt?: string;
  score?: number;
  confidence?: string;
  documentAttributes?: DocumentAttribute[];
}

// Types that match the backend API responses
export interface Application {
  applicationId: string;
  displayName: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  retrieverId: string;
  indexId: string;
  identityType?: string;
}

export interface Index {
  indexId: string;
  status?: string;
}

export interface DataSource {
  id: string;
  name: string;
  type?: string;
  status?: string;
  createdAt?: string;
}

export interface Plugin {
  id: string;
  name: string;
  type?: string;
  status?: string;
  createdAt?: string;
}

export interface SyncJob {
  executionId: string;
  displayName: string;
  startTime: Date;
  endTime?: Date;
  status: string;
  metrics?: {
    documentsAdded?: number;
    documentsModified?: number;
    documentsDeleted?: number;
    documentsFailed?: number;
    documentsScanned?: number;
  };
}
export interface SyncJobMetrics {
  syncJob: any;
  metrics: {
    totalDocuments: number;
    successfulDocuments: number;
    failedDocuments: number;
    successRate: number;
    duration: number | null;
    documentsPerSecond: number | null;
  };
}

/**
 * QBusinessProxyService - A service to proxy requests to the backend QBusiness API
 */
export class QBusinessProxyService {
  private static instance: QBusinessProxyService;
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
   * Get singleton instance of QBusinessProxyService
   */
  public static getInstance(): QBusinessProxyService {
    if (!QBusinessProxyService.instance) {
      QBusinessProxyService.instance = new QBusinessProxyService();
    }
    return QBusinessProxyService.instance;
  }

  /**
   * Check the health of the backend service
   * @returns ServiceResult with health status
   */
  public async checkHealth(): Promise<ServiceResult<{ status: string }>> {
    try {
      const response = await this.apiClient.get('/api/health');
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'HealthCheckFailed',
          message: 'Failed to check backend health',
          statusCode: error.response?.status || 500,
        },
      };
    }
  }

  /**
   * List all QBusiness applications
   * @returns ServiceResult with applications list
   */
  public async listApplications(): Promise<ServiceResult<Application[]>> {
    try {
      const response = await this.apiClient.get('/api/applications');
      return {
        success: true,
        data: response.data.applications,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'ListApplicationsFailed',
          message: 'Failed to list QBusiness applications',
          statusCode: error.response?.status || 500,
        },
      };
    }
  }

  /**
   * List indices for a specific QBusiness application
   * @param applicationId The QBusiness application ID
   * @returns ServiceResult with indices list
   */
  public async listIndices(applicationId: string): Promise<ServiceResult<Index[]>> {
    try {
      const response = await this.apiClient.get(`/api/applications/${applicationId}/indices`);
      return {
        success: true,
        data: response.data.indices,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'ListIndicesFailed',
          message: `Failed to list indices for application ${applicationId}`,
          statusCode: error.response?.status || 500,
        },
      };
    }
  }

  /**
   * List data sources for a specific QBusiness application and index
   * @param applicationId The QBusiness application ID
   * @param indexId The index ID
   * @returns ServiceResult with data sources list
   */
  public async listDataSources(
    applicationId: string,
    indexId: string,
  ): Promise<ServiceResult<DataSource[]>> {
    try {
      const response = await this.apiClient.get(
        `/api/applications/${applicationId}/indices/${indexId}/datasources`,
      );
      return {
        success: true,
        data: response.data.dataSources,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'ListDataSourcesFailed',
          message: `Failed to list data sources for application ${applicationId} and index ${indexId}`,
          statusCode: error.response?.status || 500,
        },
      };
    }
  }

  /**
   * List plugins for a specific QBusiness application
   * @param applicationId The QBusiness application ID
   * @returns ServiceResult with plugins list
   */
  public async listPlugins(applicationId: string): Promise<ServiceResult<Plugin[]>> {
    try {
      const response = await this.apiClient.get(`/api/applications/${applicationId}/plugins`);
      return {
        success: true,
        data: response.data.plugins,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'ListPluginsFailed',
          message: `Failed to list plugins for application ${applicationId}`,
          statusCode: error.response?.status || 500,
        },
      };
    }
  }

  /**
   * List sync jobs for a specific QBusiness application, index, and data source
   * @param applicationId The QBusiness application ID
   * @param indexId The index ID
   * @param dataSourceId The data source ID
   * @returns ServiceResult with sync jobs list
   */
  public async listDataSourceSyncJobs(
    applicationId: string,
    indexId: string,
    dataSourceId: string,
  ): Promise<ServiceResult<SyncJob[]>> {
    try {
      const response = await this.apiClient.get(
        `/api/applications/${applicationId}/indices/${indexId}/datasources/${dataSourceId}/syncjobs`,
      );
      return {
        success: true,
        data: response.data.syncJobs,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'ListSyncJobsFailed',
          message: `Failed to list sync jobs for application ${applicationId}, index ${indexId}, and data source ${dataSourceId}`,
          statusCode: error.response?.status || 500,
        },
      };
    }
  }

  /**
   * Get metrics for a specific sync job
   * @param applicationId The QBusiness application ID
   * @param indexId The index ID
   * @param dataSourceId The data source ID
   * @param syncJobId The sync job execution ID
   * @returns ServiceResult with sync job metrics
   */
  public async getSyncJobMetrics(
    applicationId: string,
    indexId: string,
    dataSourceId: string,
    syncJobId: string,
  ): Promise<ServiceResult<SyncJobMetrics>> {
    try {
      const response = await this.apiClient.get(
        `/api/applications/${applicationId}/indices/${indexId}/datasources/${dataSourceId}/syncjobs/${syncJobId}/metrics`,
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'GetSyncJobMetricsFailed',
          message: `Failed to get metrics for sync job ${syncJobId}`,
          statusCode: error.response?.status || 500,
        },
      };
    }
  }

  /**
   * Search for relevant content using the backend API
   * @param applicationId The QBusiness application ID
   * @param retrieverId The retriever ID
   * @param query The search query
   * @param maxResults Maximum number of results to return (default: 5)
   * @param nextToken Token for pagination
   * @param sessionId Optional session ID for credentials
   * @returns ServiceResult with search results and next token for pagination
   */
  public async searchRelevantContent(
    applicationId: string,
    retrieverId: string,
    query: string,
    maxResults = 5,
    nextToken?: string,
    sessionId?: string,
  ): Promise<
    ServiceResult<{
      results: any[];
      nextToken?: string;
    }>
  > {
    try {
      // Build the URL with query parameters
      let url = `/api/applications/${applicationId}/search?query=${encodeURIComponent(query)}&retriever_id=${encodeURIComponent(retrieverId)}&max_results=${maxResults}`;

      if (nextToken) {
        url += `&next_token=${encodeURIComponent(nextToken)}`;
      }

      if (sessionId) {
        url += `&session_id=${encodeURIComponent(sessionId)}`;
      }

      const response = await this.apiClient.get(url);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'SearchRelevantContentFailed',
          message: `Failed to search relevant content for application ${applicationId}`,
          statusCode: error.response?.status || 500,
        },
      };
    }
  }

  /**
   * Check if a user has access to a specific document
   * @param documentId The document ID to check access for
   * @param userEmail The user email to check access for
   * @param config The configuration containing applicationId, indexId, and dataSourceId
   * @param sessionId Optional session ID for credentials
   * @returns ServiceResult with access check response
   */
  public async checkAccess(
    documentId: string,
    userEmail: string,
    config: Config,
    sessionId?: string,
  ): Promise<ServiceResult<AccessCheckResponse>> {
    try {
      const url = `/api/applications/${config.applicationId}/check-access`;

      const requestData = {
        indexId: config.indexId,
        dataSourceId: config.dataSourceId,
        documentId: documentId,
        userId: userEmail,
        sessionId: sessionId,
      };

      const response = await this.apiClient.post(url, requestData);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'CheckAccessFailed',
          message: `Failed to check access for document ${documentId} and user ${userEmail}`,
          statusCode: error.response?.status || 500,
        },
      };
    }
  }
}

// Export a singleton instance
export const qBusinessProxyService = QBusinessProxyService.getInstance();
