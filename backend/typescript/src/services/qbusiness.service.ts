
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Injectable, Logger } from '@nestjs/common';
import {
  QBusinessClient,
  ListApplicationsCommand,
  ListIndicesCommand,
  ListRetrieversCommand,
  ListDataSourcesCommand,
  ListDataSourceSyncJobsCommand,
  SearchRelevantContentCommand,
  CheckDocumentAccessCommand,
  ListPluginsCommand,
  DocumentAttribute,
  ScoreConfidence,
  DataSourceStatus,
  IndexStatus,
  IdentityType,
  ApplicationStatus,
  Plugin,
  PluginType,
} from '@aws-sdk/client-qbusiness';
import * as dotenv from 'dotenv';
import {
  getClientWithSession,
  getClientWithSessionAsync,
} from './aws-client.utils';
import { DynamoDBService } from './dynamodb.service';

// Load environment variables
dotenv.config();

// Define interfaces for our return types
export interface SearchResult {
  documentId: string;
  documentTitle: string;
  documentUri?: string;
  documentExcerpt: string;
  scoreAttributes: {
    scoreConfidence?: ScoreConfidence;
  } | null;
  documentAttributes: DocumentAttribute[];
}

export interface SearchResponse {
  results: SearchResult[];
  nextToken?: string;
}

export interface SyncJobMetrics {
  totalDocuments: number;
  successfulDocuments: number;
  failedDocuments: number;
  successRate: number;
  duration: number | null;
  documentsPerSecond: number | null;
}

export interface SyncJobResponse {
  syncJob: any | null;
  metrics: SyncJobMetrics;
}

export interface SyncJob {
  executionId: string;
  displayName: string;
  startTime: string | null;
  endTime: string | null;
  status: string;
  metrics: any;
}

export interface DataSource {
  id: string;
  name: string;
  type?: string;
  status?: DataSourceStatus;
  createdAt?: string;
}

export interface IndexData {
  indexId: string;
  status?: IndexStatus;
}

export interface PluginData {
  id: string;
  name: string;
  type?: PluginType;
  status?: string;
  createdAt?: string;
}

export interface Application {
  applicationId: string;
  displayName: string;
  createdAt?: string;
  updatedAt?: string;
  identityType?: IdentityType;
  status?: ApplicationStatus;
  retrieverId: string;
  indexId: string;
}

@Injectable()
export class QBusinessService {
  private readonly logger = new Logger(QBusinessService.name);
  private readonly client: QBusinessClient;
  private readonly region: string;

  constructor(private readonly dynamoDBService: DynamoDBService) {
    // Get region from environment variables or use default
    this.region = process.env.AWS_REGION || 'us-east-1';

    // Initialize AWS client for QBusiness
    this.client = new QBusinessClient({ region: this.region });
  }

  /**
   * Search for relevant content using the SearchRelevantContent API
   * @param applicationId The QBusiness application ID
   * @param retrieverId The retriever ID
   * @param query The search query
   * @param maxResults Maximum number of results to return (default: 5)
   * @param nextToken Token for pagination
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns Object containing search results and next token for pagination
   */
  async searchRelevantContent(
    applicationId: string,
    retrieverId: string,
    query: string,
    maxResults: number = 5,
    nextToken?: string,
    sessionId?: string,
  ): Promise<SearchResponse> {
    try {
      this.logger.log(
        `Searching relevant content with query: ${query} for application ${applicationId} for sessionId ${sessionId}`,
      );

      // Create a client with session credentials if session_id is provided
      const clientToUse = await getClientWithSessionAsync<QBusinessClient>(
        'qbusiness',
        this.region,
        this.client,
        sessionId,
        undefined,
        this.dynamoDBService,
      );

      // Create input parameters for the API call
      const inputParams: any = {
        applicationId,
        queryText: query,
        contentSource: {
          retriever: {
            retrieverId,
          },
        },
        maxResults,
      };

      // Add nextToken if provided
      if (nextToken) {
        inputParams.nextToken = nextToken;
      }

      // Call the search_relevant_content API
      this.logger.log(
        `Calling search_relevant_content with params: ${JSON.stringify(inputParams)}`,
      );
      const command = new SearchRelevantContentCommand(inputParams);
      const response = await clientToUse.send(command);

      // Process the response
      const results: SearchResult[] = [];
      if (response.relevantContent && response.relevantContent.length > 0) {
        for (const content of response.relevantContent) {
          const result: SearchResult = {
            documentId: content.documentId || '',
            documentTitle: content.documentTitle || '',
            documentUri: content.documentUri,
            documentExcerpt: content.content || '',
            scoreAttributes: content.scoreAttributes
              ? {
                  scoreConfidence: content.scoreAttributes.scoreConfidence,
                }
              : null,
            documentAttributes: content.documentAttributes || [],
          };
          results.push(result);
        }
      }

      return {
        results,
        nextToken: response.nextToken,
      };
    } catch (error) {
      this.logger.error(`Error searching relevant content: ${error}`);
      throw new Error(`Failed to search for relevant content: ${error}`);
    }
  }

  /**
   * Get details of a specific sync job
   * @param applicationId The QBusiness application ID
   * @param indexId The index ID
   * @param dataSourceId The data source ID
   * @param syncJobId The sync job execution ID
   * @returns Details of the sync job or null if not found
   */
  async getSyncJobDetails(
    applicationId: string,
    indexId: string,
    dataSourceId: string,
    syncJobId: string,
  ): Promise<any | null> {
    try {
      this.logger.log(`Getting details for sync job ${syncJobId}`);

      // Prepare parameters for the API call
      const params = {
        applicationId,
        indexId,
        dataSourceId,
      };

      // Call the list_data_source_sync_jobs API
      const command = new ListDataSourceSyncJobsCommand(params);
      let response = await this.client.send(command);

      // Find the specific sync job
      if (response.history && response.history.length > 0) {
        for (const job of response.history) {
          if (job.executionId === syncJobId) {
            return job;
          }
        }
      }

      // If not found in the first page, paginate through all sync jobs
      let nextToken = response.nextToken;
      while (nextToken) {
        const paginatedParams = { ...params, nextToken };
        const paginatedCommand = new ListDataSourceSyncJobsCommand(
          paginatedParams,
        );
        response = await this.client.send(paginatedCommand);

        if (response.history && response.history.length > 0) {
          for (const job of response.history) {
            if (job.executionId === syncJobId) {
              return job;
            }
          }
        }

        nextToken = response.nextToken;
      }

      this.logger.warn(`Sync job ${syncJobId} not found`);
      return null;
    } catch (error) {
      this.logger.error(`Error getting sync job details: ${error}`);
      throw error;
    }
  }

  /**
   * Get sync job metrics with additional calculated fields
   * @param applicationId The QBusiness application ID
   * @param indexId The index ID
   * @param dataSourceId The data source ID
   * @param syncJobId The sync job execution ID
   * @returns Sync job details and calculated metrics
   */
  async getSyncJobMetrics(
    applicationId: string,
    indexId: string,
    dataSourceId: string,
    syncJobId: string,
  ): Promise<SyncJobResponse> {
    try {
      this.logger.log(`Getting metrics for sync job ${syncJobId}`);

      // Get sync job details
      const syncJob = await this.getSyncJobDetails(
        applicationId,
        indexId,
        dataSourceId,
        syncJobId,
      );

      if (!syncJob) {
        return {
          syncJob: null,
          metrics: {
            totalDocuments: 0,
            successfulDocuments: 0,
            failedDocuments: 0,
            successRate: 0,
            duration: null,
            documentsPerSecond: null,
          },
        };
      }

      // Calculate metrics
      const documentsAdded = parseInt(
        syncJob.metrics?.documentsAdded?.toString() || '0',
        10,
      );
      const documentsModified = parseInt(
        syncJob.metrics?.documentsModified?.toString() || '0',
        10,
      );
      const documentsDeleted = parseInt(
        syncJob.metrics?.documentsDeleted?.toString() || '0',
        10,
      );
      const documentsFailed = parseInt(
        syncJob.metrics?.documentsFailed?.toString() || '0',
        10,
      );

      const successfulDocuments =
        documentsAdded + documentsModified + documentsDeleted;
      const totalDocuments = successfulDocuments + documentsFailed;
      const successRate =
        totalDocuments > 0 ? (successfulDocuments / totalDocuments) * 100 : 0;

      // Calculate duration in seconds
      let duration: number | null = null;
      let documentsPerSecond: number | null = null;

      const startTime = syncJob.startTime;
      const endTime = syncJob.endTime;

      if (startTime && endTime) {
        duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

        if (duration > 0 && totalDocuments > 0) {
          documentsPerSecond = totalDocuments / duration;
        }
      }

      return {
        syncJob,
        metrics: {
          totalDocuments,
          successfulDocuments,
          failedDocuments: documentsFailed,
          successRate,
          duration,
          documentsPerSecond,
        },
      };
    } catch (error) {
      this.logger.error(`Error getting sync job metrics: ${error}`);
      throw error;
    }
  }

  /**
   * List sync jobs for a specific data source
   * @param applicationId The QBusiness application ID
   * @param indexId The index ID
   * @param dataSourceId The data source ID
   * @returns List of sync jobs for the specified data source
   */
  async listDataSourceSyncJobs(
    applicationId: string,
    indexId: string,
    dataSourceId: string,
  ): Promise<SyncJob[]> {
    const syncJobs: SyncJob[] = [];
    let nextToken: string | undefined = undefined;

    try {
      this.logger.log(
        `Listing sync jobs for application ${applicationId}, index ${indexId}, and data source ${dataSourceId}`,
      );

      // Paginate through all sync jobs
      do {
        // Prepare parameters for the API call
        const params: any = {
          applicationId,
          indexId,
          dataSourceId,
        };

        if (nextToken) {
          params.nextToken = nextToken;
        }

        // Call the list_data_source_sync_jobs API
        const command = new ListDataSourceSyncJobsCommand(params);
        const response = await this.client.send(command);

        console.log(response);

        // Extract sync jobs from the response
        if (response.history && response.history.length > 0) {
          for (const job of response.history) {
            // Get start time and end time
            const startTime = job.startTime;
            const endTime = job.endTime;

            // Format display name with date and status
            let displayName;
            if (startTime) {
              // Format date string
              const dateStr = startTime.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                hour12: true,
              });
              displayName = `Sync Job - ${dateStr} (${job.status || 'Unknown'})`;
            } else {
              displayName = `Sync Job (${job.status || 'Unknown'})`;
            }

            // Extract metrics
            const metrics: any = {};
            if (job.metrics) {
              metrics.documentsAdded = parseInt(
                job.metrics.documentsAdded?.toString() || '0',
                10,
              );
              metrics.documentsModified = parseInt(
                job.metrics.documentsModified?.toString() || '0',
                10,
              );
              metrics.documentsDeleted = parseInt(
                job.metrics.documentsDeleted?.toString() || '0',
                10,
              );
              metrics.documentsFailed = parseInt(
                job.metrics.documentsFailed?.toString() || '0',
                10,
              );
              metrics.documentsScanned = parseInt(
                job.metrics.documentsScanned?.toString() || '0',
                10,
              );
            }

            // Create sync job object
            const syncJob: SyncJob = {
              executionId: job.executionId || '',
              displayName,
              startTime: startTime ? startTime.toISOString() : null,
              endTime: endTime ? endTime.toISOString() : null,
              status: job.status || 'UNKNOWN',
              metrics,
            };
            syncJobs.push(syncJob);
          }
        }

        // Check if there are more results
        nextToken = response.nextToken;
      } while (nextToken);

      // Sort by start time (most recent first)
      syncJobs.sort((a, b) => {
        if (!a.startTime) return 1;
        if (!b.startTime) return -1;
        return b.startTime.localeCompare(a.startTime);
      });

      return syncJobs;
    } catch (error) {
      this.logger.error(`Error listing sync jobs: ${error}`);
      throw error;
    }
  }

  /**
   * List data sources for a specific index and application
   * @param applicationId The QBusiness application ID
   * @param indexId The index ID
   * @param maxResults Maximum number of results to return per page
   * @returns List of data sources for the specified index and application
   */
  async listDataSources(
    applicationId: string,
    indexId: string,
    maxResults: number = 10,
  ): Promise<DataSource[]> {
    const dataSources: DataSource[] = [];

    try {
      this.logger.log(
        `Listing data sources for application ${applicationId} and index ${indexId}`,
      );

      // Prepare parameters for the API call
      const params = {
        applicationId,
        indexId,
      };

      // Call the list_data_sources API
      const command = new ListDataSourcesCommand(params);
      const response = await this.client.send(command);

      console.log('response plugins and ds', response);

      // Extract data sources from the response
      if (response.dataSources && response.dataSources.length > 0) {
        for (const ds of response.dataSources) {
          const dataSource: DataSource = {
            id: ds.dataSourceId || '',
            name: ds.displayName || ds.dataSourceId || 'Unnamed Data Source',
            type: ds.type,
            status: ds.status,
            createdAt: ds.createdAt ? ds.createdAt.toISOString() : undefined,
          };
          dataSources.push(dataSource);
        }
      }

      return dataSources;
    } catch (error) {
      this.logger.error(`Error listing data sources: ${error}`);
      throw error;
    }
  }

  /**
   * List indices for a specific application
   * @param applicationId The QBusiness application ID
   * @param maxResults Maximum number of results to return per page
   * @returns List of indices for the application
   */
  async listIndices(
    applicationId: string,
    maxResults: number = 100,
  ): Promise<IndexData[]> {
    const indices: IndexData[] = [];

    try {
      this.logger.log(`Listing indices for application ${applicationId}`);
      const params = {
        applicationId,
      };

      // Call the list_indices API
      const command = new ListIndicesCommand(params);
      const response = await this.client.send(command);

      // Extract indices from the response
      if (response.indices && response.indices.length > 0) {
        for (const index of response.indices) {
          const indexData: IndexData = {
            indexId: index.indexId || '',
            status: index.status,
          };
          indices.push(indexData);
        }
      }

      return indices;
    } catch (error) {
      this.logger.error(`Error listing indices: ${error}`);
      throw error;
    }
  }

  /**
   * Get the index ID for a specific application
   * @param applicationId The QBusiness application ID
   * @returns The index ID or empty string if not found
   */
  async getIndexId(applicationId: string): Promise<string> {
    try {
      this.logger.log(`Fetching index for application ${applicationId}`);

      // Call the list_indices API
      const command = new ListIndicesCommand({
        applicationId,
        maxResults: 1,
      });

      const response = await this.client.send(command);

      // Check if indices exist and return the first one's ID
      if (
        response.indices &&
        response.indices.length > 0 &&
        response.indices[0].indexId
      ) {
        return response.indices[0].indexId;
      }

      return '';
    } catch (error) {
      this.logger.error(`Error getting index ID: ${error}`);
      return '';
    }
  }

  /**
   * Get the retriever ID for a specific application
   * @param applicationId The QBusiness application ID
   * @returns The retriever ID or empty string if not found
   */
  async getRetrieverId(applicationId: string): Promise<string> {
    try {
      this.logger.log(`Fetching retriever for application ${applicationId}`);

      // Call the list_retrievers API
      const command = new ListRetrieversCommand({
        applicationId,
        maxResults: 50,
      });

      const response = await this.client.send(command);

      // Check if retrievers exist and return the first one's ID
      if (
        response.retrievers &&
        response.retrievers.length > 0 &&
        response.retrievers[0].retrieverId
      ) {
        return response.retrievers[0].retrieverId;
      }

      return '';
    } catch (error) {
      this.logger.error(`Error getting retriever ID: ${error}`);
      return '';
    }
  }

  /**
   * List plugins for a specific application
   * @param applicationId The QBusiness application ID
   * @param maxResults Maximum number of results to return per page
   * @returns List of plugins for the specified application
   */
  async listPlugins(
    applicationId: string,
    maxResults: number = 10,
  ): Promise<PluginData[]> {
    const plugins: PluginData[] = [];
    let nextToken: string | undefined = undefined;

    try {
      this.logger.log(`Listing plugins for application ${applicationId}`);

      // Paginate through all plugins
      do {
        // Prepare parameters for the API call
        const params: any = {
          applicationId,
          maxResults,
        };

        if (nextToken) {
          params.nextToken = nextToken;
        }

        // Call the list_plugins API
        const command = new ListPluginsCommand(params);
        const response = await this.client.send(command);

        // Extract plugins from the response
        if (response.plugins && response.plugins.length > 0) {
          for (const plugin of response.plugins) {
            const pluginData: PluginData = {
              id: plugin.pluginId || '',
              name: plugin.displayName || plugin.pluginId || 'Unnamed Plugin',
              type: plugin.type,
              // Plugin type doesn't have a status property in the AWS SDK
              status: 'ACTIVE', // Default to ACTIVE as a fallback
              createdAt: plugin.createdAt
                ? plugin.createdAt.toISOString()
                : undefined,
            };
            plugins.push(pluginData);
          }
        }

        // Check if there are more results
        nextToken = response.nextToken;
      } while (nextToken);

      return plugins;
    } catch (error) {
      this.logger.error(`Error listing plugins: ${error}`);
      throw error;
    }
  }

  /**
   * Check if a user has access to a specific document
   * @param applicationId The QBusiness application ID
   * @param indexId The index ID
   * @param dataSourceId The data source ID
   * @param documentId The document ID to check access for
   * @param userId The user ID (typically email) to check access for
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns Access check response containing access status
   */
  async checkAccess(
    applicationId: string,
    indexId: string,
    dataSourceId: string,
    documentId: string,
    userId: string,
    sessionId?: string,
  ): Promise<any> {
    try {
      this.logger.log(
        `Checking access for document ${documentId} and user ${userId} in application id ${applicationId} index id ${indexId} datasource id ${dataSourceId}`,
      );

      // Create a client with session credentials if session_id is provided
      const clientToUse = await getClientWithSessionAsync<QBusinessClient>(
        'qbusiness',
        this.region,
        this.client,
        sessionId,
        undefined,
        this.dynamoDBService,
      );

      // Call the check_document_access API
      const command = new CheckDocumentAccessCommand({
        applicationId,
        indexId,
        dataSourceId,
        documentId,
        userId,
      });

      const response = await clientToUse.send(command);

      // Return the response
      return response;
    } catch (error) {
      this.logger.error(`Error checking document access: ${error}`);
      throw error;
    }
  }

  /**
   * List all QBusiness applications
   * @param maxResults Maximum number of results to return per page
   * @returns List of QBusiness applications with retriever IDs
   */
  async listApplications(maxResults: number = 100): Promise<Application[]> {
    const applications: Application[] = [];
    let nextToken: string | undefined = undefined;

    try {
      this.logger.log('Listing QBusiness applications');

      // Paginate through all applications
      do {
        // Prepare parameters for the API call
        const params: any = { maxResults };
        if (nextToken) {
          params.nextToken = nextToken;
        }

        // Call the list_applications API
        const command = new ListApplicationsCommand(params);
        const response = await this.client.send(command);

        // Extract applications from the response
        if (response.applications && response.applications.length > 0) {
          for (const app of response.applications) {
            const appId = app.applicationId;

            if (appId) {
              // Get retriever ID and index ID for this application
              const retrieverId = await this.getRetrieverId(appId);
              const indexId = await this.getIndexId(appId);
              this.logger.log(
                `Retrieved retriever ID ${retrieverId} and index ID ${indexId} for application ${appId}`,
              );

              const application: Application = {
                applicationId: appId,
                displayName: app.displayName || appId || 'Unnamed Application',
                createdAt: app.createdAt
                  ? app.createdAt.toISOString()
                  : undefined,
                updatedAt: app.updatedAt
                  ? app.updatedAt.toISOString()
                  : undefined,
                identityType: app.identityType,
                status: app.status,
                retrieverId,
                indexId,
              };
              applications.push(application);
            }
          }
        }

        // Check if there are more results
        nextToken = response.nextToken;
      } while (nextToken);

      return applications;
    } catch (error) {
      // Log the error and re-raise
      this.logger.error(`Error listing QBusiness applications: ${error}`);
      throw error;
    }
  }
}
