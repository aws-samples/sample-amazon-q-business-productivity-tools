// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { API_BASE_URL } from '../../constants/apiConstants';
import { ServiceResult } from '../service.types';

// Types that match the backend API responses
export interface LogGroup {
  logGroupName: string;
  creationTime?: number;
  retentionInDays?: number;
  storedBytes?: number;
  arn?: string;
}

export interface LogStream {
  logStreamName: string;
  creationTime?: number;
  firstEventTimestamp?: number;
  lastEventTimestamp?: number;
  lastIngestionTime?: number;
  uploadSequenceToken?: string;
  arn?: string;
}

export interface LogEvent {
  timestamp: number;
  message: string;
  ingestionTime?: number;
  logStreamName?: string;
}

export interface QueryResult {
  queryId: string;
  status: 'Scheduled' | 'Running' | 'Complete' | 'Failed' | 'Cancelled' | string;
  results?: string[][];
  statistics?: {
    recordsMatched: number;
    recordsScanned: number;
    bytesScanned: number;
  };
}

export interface Config {
  applicationId?: string;
  indexId?: string;
  dataSourceId: string;
  syncJobId?: string;
  syncJobExecutionId?: string;
  syncJobStartTime?: string;
  syncJobEndTime?: string;
}

export interface Document {
  DocumentId: string;
  DocumentTitle: string;
  CrawlAction?: string;
  ConnectorDocumentStatus?: any;
  CrawlStatus?: any;
  SyncStatus?: any;
  ACL?: any;
  ErrorCode?: string;
  ErrorMessage?: string;
}

export interface SyncError {
  DocumentId: string;
  DocumentTitle?: string;
  ErrorCode: string;
  ErrorMessage: string;
  LogLevel: string;
  IndexId?: string;
  DataSourceId?: string;
  DataSourceSyncExecutionId?: string;
  timestamp?: number;
  SourceURI?: string;
}

export interface GroupWithMembers {
  groupName: string;
  displayName: string;
  isGroupFederated: boolean;
  members: {
    users: Array<{
      id: string;
      email?: string;
      isFederated: boolean;
    }>;
    groups: Array<{
      name: string;
      displayName: string;
      isFederated: boolean;
    }>;
  };
  totalMembers: number;
}

/**
 * CloudWatchProxyService - A service to proxy requests to the backend CloudWatch API
 */
export class CloudWatchProxyService {
  private static instance: CloudWatchProxyService;
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
   * Get singleton instance of CloudWatchProxyService
   */
  public static getInstance(): CloudWatchProxyService {
    if (!CloudWatchProxyService.instance) {
      CloudWatchProxyService.instance = new CloudWatchProxyService();
    }
    return CloudWatchProxyService.instance;
  }

  /**
   * List CloudWatch log groups
   * @param prefix Filter log groups by prefix
   * @param limit Maximum number of log groups to return
   * @param nextToken Token for pagination
   * @param sessionId Session ID for credentials
   * @returns ServiceResult with log groups and next token
   */
  public async listLogGroups(
    prefix?: string,
    limit = 50,
    nextToken?: string,
    sessionId?: string,
  ): Promise<
    ServiceResult<{
      logGroups: LogGroup[];
      nextToken?: string;
    }>
  > {
    try {
      // Build the URL with query parameters
      let url = `/api/cloudwatch/log-groups?limit=${limit}`;

      if (prefix) {
        url += `&prefix=${encodeURIComponent(prefix)}`;
      }

      if (nextToken) {
        url += `&nextToken=${encodeURIComponent(nextToken)}`;
      }

      if (sessionId) {
        url += `&sessionId=${encodeURIComponent(sessionId)}`;
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
          code: 'ListLogGroupsFailed',
          message: 'Failed to list CloudWatch log groups',
          statusCode: error.response?.status || 500,
        },
      };
    }
  }

  /**
   * List CloudWatch log streams for a specific log group
   * @param logGroupName The name of the log group
   * @param prefix Filter log streams by prefix
   * @param orderBy Order streams by 'LogStreamName' or 'LastEventTime'
   * @param descending Sort in descending order if true
   * @param limit Maximum number of log streams to return
   * @param nextToken Token for pagination
   * @param sessionId Session ID for credentials
   * @returns ServiceResult with log streams and next token
   */
  public async listLogStreams(
    logGroupName: string,
    prefix?: string,
    orderBy: 'LogStreamName' | 'LastEventTime' = 'LastEventTime',
    descending = true,
    limit = 50,
    nextToken?: string,
    sessionId?: string,
  ): Promise<
    ServiceResult<{
      logStreams: LogStream[];
      nextToken?: string;
    }>
  > {
    try {
      // Build the URL with query parameters
      let url = `/api/cloudwatch/log-streams?logGroupName=${encodeURIComponent(logGroupName)}&orderBy=${orderBy}&descending=${descending}&limit=${limit}`;

      if (prefix) {
        url += `&prefix=${encodeURIComponent(prefix)}`;
      }

      if (nextToken) {
        url += `&nextToken=${encodeURIComponent(nextToken)}`;
      }

      if (sessionId) {
        url += `&sessionId=${encodeURIComponent(sessionId)}`;
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
          code: 'ListLogStreamsFailed',
          message: `Failed to list log streams for log group ${logGroupName}`,
          statusCode: error.response?.status || 500,
        },
      };
    }
  }

  /**
   * Get log events from a specific log stream
   * @param logGroupName The name of the log group
   * @param logStreamName The name of the log stream
   * @param startTime Start time in milliseconds
   * @param endTime End time in milliseconds
   * @param limit Maximum number of log events to return
   * @param startFromHead If true, read from oldest to newest
   * @param nextToken Token for pagination
   * @param sessionId Session ID for credentials
   * @returns ServiceResult with log events and next tokens
   */
  public async getLogEvents(
    logGroupName: string,
    logStreamName: string,
    startTime?: number,
    endTime?: number,
    limit = 10000,
    startFromHead = true,
    nextToken?: string,
    sessionId?: string,
  ): Promise<
    ServiceResult<{
      logEvents: LogEvent[];
      nextForwardToken?: string;
      nextBackwardToken?: string;
    }>
  > {
    try {
      // Build the URL with query parameters
      let url = `/api/cloudwatch/log-events?logGroupName=${encodeURIComponent(logGroupName)}&logStreamName=${encodeURIComponent(logStreamName)}&limit=${limit}&startFromHead=${startFromHead}`;

      if (startTime) {
        url += `&startTime=${startTime}`;
      }

      if (endTime) {
        url += `&endTime=${endTime}`;
      }

      if (nextToken) {
        url += `&nextToken=${encodeURIComponent(nextToken)}`;
      }

      if (sessionId) {
        url += `&sessionId=${encodeURIComponent(sessionId)}`;
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
          code: 'GetLogEventsFailed',
          message: `Failed to get log events from ${logGroupName}/${logStreamName}`,
          statusCode: error.response?.status || 500,
        },
      };
    }
  }

  /**
   * Filter log events across multiple log streams
   * @param logGroupName The name of the log group
   * @param logStreamNames List of log stream names
   * @param filterPattern Pattern to filter logs
   * @param startTime Start time in milliseconds
   * @param endTime End time in milliseconds
   * @param limit Maximum number of log events to return
   * @param nextToken Token for pagination
   * @param sessionId Session ID for credentials
   * @returns ServiceResult with filtered log events and next token
   */
  public async filterLogEvents(
    logGroupName: string,
    logStreamNames?: string[],
    filterPattern?: string,
    startTime?: number,
    endTime?: number,
    limit = 10000,
    nextToken?: string,
    sessionId?: string,
  ): Promise<
    ServiceResult<{
      logEvents: LogEvent[];
      nextToken?: string;
      searchedLogStreams?: any[];
    }>
  > {
    try {
      // Build the URL with query parameters
      let url = `/api/cloudwatch/filter-log-events?log_group_name=${encodeURIComponent(logGroupName)}&limit=${limit}`;

      if (logStreamNames && logStreamNames.length > 0) {
        logStreamNames.forEach((streamName) => {
          url += `&log_stream_names=${encodeURIComponent(streamName)}`;
        });
      }

      if (filterPattern) {
        url += `&filter_pattern=${encodeURIComponent(filterPattern)}`;
      }

      if (startTime) {
        url += `&start_time=${startTime}`;
      }

      if (endTime) {
        url += `&end_time=${endTime}`;
      }

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
          code: 'FilterLogEventsFailed',
          message: `Failed to filter log events from ${logGroupName}`,
          statusCode: error.response?.status || 500,
        },
      };
    }
  }

  /**
   * Fetch group membership information from CloudWatch logs
   * @param config Configuration with application and sync job details
   * @param sessionId Session ID for credentials
   * @returns ServiceResult with list of groups with members
   */
  public async fetchGroupMembership(
    config: Config,
    sessionId?: string,
  ): Promise<ServiceResult<GroupWithMembers[]>> {
    try {
      const requestData = {
        config: config,
        sessionId: sessionId,
      };

      const response = await this.apiClient.post('/api/cloudwatch/group-membership', requestData);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'FetchGroupMembershipFailed',
          message: 'Failed to fetch group membership information',
          statusCode: error.response?.status || 500,
        },
      };
    }
  }

  /**
   * Fetch ACL documents from CloudWatch logs
   * @param config Configuration with application and sync job details
   * @param sessionId Session ID for credentials
   * @returns ServiceResult with list of documents with ACL information
   */
  public async fetchACLDocuments(
    config: Config,
    sessionId?: string,
  ): Promise<ServiceResult<Document[]>> {
    try {
      const requestData = {
        config: config,
        sessionId: sessionId,
      };

      const response = await this.apiClient.post('/api/cloudwatch/acl-documents', requestData);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'FetchACLDocumentsFailed',
          message: 'Failed to fetch ACL documents',
          statusCode: error.response?.status || 500,
        },
      };
    }
  }

  /**
   * Fetch sync errors from CloudWatch logs
   * @param config Configuration with application and sync job details
   * @param sessionId Session ID for credentials
   * @returns ServiceResult with list of sync errors
   */
  public async fetchSyncErrors(
    config: Config,
    sessionId?: string,
  ): Promise<ServiceResult<SyncError[]>> {
    try {
      const requestData = {
        config: config,
        sessionId: sessionId,
      };

      const response = await this.apiClient.post('/api/cloudwatch/sync-errors', requestData);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'FetchSyncErrorsFailed',
          message: 'Failed to fetch sync errors',
          statusCode: error.response?.status || 500,
        },
      };
    }
  }

  /**
   * Validate AWS CloudWatch configuration
   * @param sessionId Session ID for credentials
   * @returns ServiceResult with validation result
   */
  public async validateConfiguration(sessionId?: string): Promise<ServiceResult<boolean>> {
    try {
      let url = '/api/cloudwatch/validate';

      if (sessionId) {
        url += `?sessionId=${encodeURIComponent(sessionId)}`;
      }

      const response = await this.apiClient.get(url);

      return {
        success: true,
        data: response.data.valid,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'ValidateConfigurationFailed',
          message: 'Failed to validate AWS CloudWatch configuration',
          statusCode: error.response?.status || 500,
        },
      };
    }
  }
}

// Export a singleton instance
export const cloudWatchProxyService = CloudWatchProxyService.getInstance();
