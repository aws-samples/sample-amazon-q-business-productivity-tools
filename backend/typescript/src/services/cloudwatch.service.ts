// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Injectable, Logger } from '@nestjs/common';
import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  DescribeLogStreamsCommand,
  GetLogEventsCommand,
  FilterLogEventsCommand,
  StartQueryCommand,
  GetQueryResultsCommand,
  DeleteLogStreamCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import * as dotenv from 'dotenv';
import { getClientWithSessionAsync } from './aws-client.utils';
import { DynamoDBService } from './dynamodb.service';

// Load environment variables
dotenv.config();

// Define interfaces for our return types
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

export interface GroupMember {
  id: string;
  email: string;
  isFederated: boolean;
}

export interface GroupSubgroup {
  name: string;
  displayName: string;
  isFederated: boolean;
}

export interface GroupMembers {
  users: GroupMember[];
  groups: GroupSubgroup[];
}

export interface Group {
  groupName: string;
  displayName: string;
  isGroupFederated: boolean;
  members: GroupMembers;
  totalMembers: number;
}

export interface AclEntry {
  ACLEntityType: string;
  ACLEntityName: string;
  ACLEntityAccess: string;
  ACLUniqueIdentifier: string;
  ACLEntityGlobalname: string;
}

export interface AclDocument {
  DocumentId: string;
  DocumentTitle: string;
  CrawlAction: string;
  ConnectorDocumentStatus: string;
  ACL: AclEntry[];
}

@Injectable()
export class CloudWatchService {
  private readonly logger = new Logger(CloudWatchService.name);
  private readonly cloudwatchLogsClient: CloudWatchLogsClient;
  private readonly cloudwatchClient: CloudWatchClient;
  private readonly region: string;

  // Time buffer for log queries (5 minutes before and after sync job)
  private readonly TIME_BUFFER_MS = 5 * 60 * 1000;

  constructor(private readonly dynamoDBService: DynamoDBService) {
    // Get region from environment variables or use default
    this.region = process.env.AWS_REGION || 'us-east-1';

    // Initialize AWS clients
    this.cloudwatchLogsClient = new CloudWatchLogsClient({
      region: this.region,
    });
    this.cloudwatchClient = new CloudWatchClient({ region: this.region });
  }

  /**
   * List CloudWatch log groups with pagination
   * @param prefix Filter log groups by prefix
   * @param limit Maximum number of log groups to return
   * @param nextToken Token for pagination
   * @param sessionId Session ID for credentials
   * @returns Response containing log groups and next token
   */
  async listLogGroups(
    prefix?: string,
    limit: number = 50,
    nextToken?: string,
    sessionId?: string,
  ): Promise<{ logGroups: LogGroup[]; nextToken?: string }> {
    try {
      // Get client with session if provided
      const client = await getClientWithSessionAsync<CloudWatchLogsClient>(
        'cloudwatch-logs',
        this.region,
        this.cloudwatchLogsClient,
        sessionId,
        undefined,
        this.dynamoDBService,
      );

      // Prepare parameters
      const params: any = {
        limit,
      };

      if (prefix) {
        params.logGroupNamePrefix = prefix;
      }

      if (nextToken) {
        params.nextToken = nextToken;
      }

      // Call the API
      const command = new DescribeLogGroupsCommand(params);
      const response = await client.send(command);

      // Transform the response
      const logGroups: LogGroup[] = [];
      if (response.logGroups) {
        for (const group of response.logGroups) {
          logGroups.push({
            logGroupName: group.logGroupName || '',
            creationTime: group.creationTime,
            retentionInDays: group.retentionInDays,
            storedBytes: group.storedBytes,
            arn: group.arn,
          });
        }
      }

      return {
        logGroups,
        nextToken: response.nextToken,
      };
    } catch (error) {
      this.logger.error(`Error listing log groups: ${error}`);
      throw new Error(`Failed to list CloudWatch log groups: ${error}`);
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
  async listLogStreams(
    logGroupName: string,
    prefix?: string,
    orderBy: string = 'LastEventTime',
    descending: boolean = true,
    limit: number = 50,
    nextToken?: string,
    sessionId?: string,
  ): Promise<{ logStreams: LogStream[]; nextToken?: string }> {
    try {
      // Get client with session if provided
      const client = await getClientWithSessionAsync<CloudWatchLogsClient>(
        'cloudwatch-logs',
        this.region,
        this.cloudwatchLogsClient,
        sessionId,
        undefined,
        this.dynamoDBService,
      );

      // Prepare parameters
      const params: any = {
        logGroupName,
        orderBy,
        descending,
        limit,
      };

      if (prefix) {
        params.logStreamNamePrefix = prefix;
      }

      if (nextToken) {
        params.nextToken = nextToken;
      }

      // Call the API
      const command = new DescribeLogStreamsCommand(params);
      const response = await client.send(command);

      // Transform the response
      const logStreams: LogStream[] = [];
      if (response.logStreams) {
        for (const stream of response.logStreams) {
          logStreams.push({
            logStreamName: stream.logStreamName || '',
            creationTime: stream.creationTime,
            firstEventTimestamp: stream.firstEventTimestamp,
            lastEventTimestamp: stream.lastEventTimestamp,
            lastIngestionTime: stream.lastIngestionTime,
            uploadSequenceToken: stream.uploadSequenceToken,
            arn: stream.arn,
          });
        }
      }

      return {
        logStreams,
        nextToken: response.nextToken,
      };
    } catch (error) {
      this.logger.error(
        `Error listing log streams for log group ${logGroupName}: ${error}`,
      );
      throw new Error(`Failed to list CloudWatch log streams: ${error}`);
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
  async getLogEvents(
    logGroupName: string,
    logStreamName: string,
    startTime?: number,
    endTime?: number,
    limit: number = 10000,
    startFromHead: boolean = true,
    nextToken?: string,
    sessionId?: string,
  ): Promise<{
    logEvents: LogEvent[];
    nextForwardToken?: string;
    nextBackwardToken?: string;
  }> {
    try {
      // Get client with session if provided
      const client = await getClientWithSessionAsync<CloudWatchLogsClient>(
        'cloudwatch-logs',
        this.region,
        this.cloudwatchLogsClient,
        sessionId,
        undefined,
        this.dynamoDBService,
      );

      // Prepare parameters
      const params: any = {
        logGroupName,
        logStreamName,
        limit,
        startFromHead,
      };

      if (startTime) {
        params.startTime = startTime;
      }

      if (endTime) {
        params.endTime = endTime;
      }

      if (nextToken) {
        params.nextToken = nextToken;
      }

      // Call the API
      const command = new GetLogEventsCommand(params);
      const response = await client.send(command);

      // Transform the response
      const logEvents: LogEvent[] = [];
      if (response.events) {
        for (const event of response.events) {
          logEvents.push({
            timestamp: event.timestamp || 0,
            message: event.message || '',
            ingestionTime: event.ingestionTime,
          });
        }
      }

      return {
        logEvents,
        nextForwardToken: response.nextForwardToken,
        nextBackwardToken: response.nextBackwardToken,
      };
    } catch (error) {
      this.logger.error(
        `Error getting log events from ${logGroupName}/${logStreamName}: ${error}`,
      );
      throw new Error(`Failed to get CloudWatch log events: ${error}`);
    }
  }

  /**
   * Filter log events across multiple log streams with pagination
   * @param logGroupName The name of the log group
   * @param logStreamNames List of log stream names
   * @param filterPattern Pattern to filter logs
   * @param startTime Start time in milliseconds
   * @param endTime End time in milliseconds
   * @param limit Maximum number of log events to return
   * @param nextToken Token for pagination
   * @param sessionId Session ID for credentials
   * @returns Response containing filtered log events and next token
   */
  async filterLogEvents(
    logGroupName: string,
    logStreamNames?: string[],
    filterPattern?: string,
    startTime?: number,
    endTime?: number,
    limit: number = 10000,
    nextToken?: string,
    sessionId?: string,
  ): Promise<{
    logEvents: LogEvent[];
    nextToken?: string;
    searchedLogStreams?: any[];
  }> {
    try {
      // Get client with session if provided
      const client = await getClientWithSessionAsync<CloudWatchLogsClient>(
        'cloudwatch-logs',
        this.region,
        this.cloudwatchLogsClient,
        sessionId,
        undefined,
        this.dynamoDBService,
      );

      // Prepare parameters
      const params: any = {
        logGroupName,
        limit,
      };

      if (logStreamNames && logStreamNames.length > 0) {
        params.logStreamNames = logStreamNames;
      }

      if (filterPattern) {
        params.filterPattern = filterPattern;
      }

      if (startTime) {
        params.startTime = startTime;
      }

      if (endTime) {
        params.endTime = endTime;
      }

      if (nextToken) {
        params.nextToken = nextToken;
      }

      // Call the API
      const command = new FilterLogEventsCommand(params);
      const response = await client.send(command);

      // Transform the response
      const logEvents: LogEvent[] = [];
      if (response.events) {
        for (const event of response.events) {
          logEvents.push({
            timestamp: event.timestamp || 0,
            message: event.message || '',
            ingestionTime: event.ingestionTime,
            logStreamName: event.logStreamName,
          });
        }
      }

      return {
        logEvents,
        nextToken: response.nextToken,
        searchedLogStreams: response.searchedLogStreams,
      };
    } catch (error) {
      this.logger.error(
        `Error filtering log events from ${logGroupName}: ${error}`,
      );
      throw new Error(`Failed to filter CloudWatch log events: ${error}`);
    }
  }

  /**
   * Execute a CloudWatch Logs Insights query
   * @param logGroupNames List of log group names
   * @param queryString The query string
   * @param startTime Start time in milliseconds
   * @param endTime End time in milliseconds
   * @param limit Maximum number of results to return
   * @param sessionId Session ID for credentials
   * @returns Query results and metadata
   */
  async executeQuery(
    logGroupNames: string[],
    queryString: string,
    startTime: number,
    endTime: number,
    limit: number = 1000,
    sessionId?: string,
  ): Promise<{
    queryId: string;
    status: string;
    results: any[];
    statistics: any;
  }> {
    try {
      // Get client with session if provided
      const client = await getClientWithSessionAsync<CloudWatchLogsClient>(
        'cloudwatch-logs',
        this.region,
        this.cloudwatchLogsClient,
        sessionId,
        undefined,
        this.dynamoDBService,
      );

      // Start the query
      const startCommand = new StartQueryCommand({
        logGroupNames,
        startTime: Math.floor(startTime / 1000), // Convert to seconds
        endTime: Math.floor(endTime / 1000), // Convert to seconds
        queryString,
        limit,
      });

      const startResponse = await client.send(startCommand);

      const queryId = startResponse.queryId;
      if (!queryId) {
        throw new Error('Failed to start CloudWatch Logs Insights query');
      }

      // Poll for results
      let status = 'Running';
      let results: any[] = [];
      let statistics: any = {};

      while (status === 'Running' || status === 'Scheduled') {
        // Wait a bit before polling again
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Get query results
        const resultsCommand = new GetQueryResultsCommand({
          queryId,
        });

        const resultsResponse = await client.send(resultsCommand);

        status = resultsResponse.status || 'Failed';

        if (resultsResponse.results) {
          results = resultsResponse.results;
        }

        if (resultsResponse.statistics) {
          statistics = {
            recordsMatched: resultsResponse.statistics.recordsMatched || 0,
            recordsScanned: resultsResponse.statistics.recordsScanned || 0,
            bytesScanned: resultsResponse.statistics.bytesScanned || 0,
          };
        }

        if (
          status === 'Complete' ||
          status === 'Failed' ||
          status === 'Cancelled'
        ) {
          break;
        }
      }

      return {
        queryId,
        status,
        results,
        statistics,
      };
    } catch (error) {
      this.logger.error(
        `Error executing CloudWatch Logs Insights query: ${error}`,
      );
      throw new Error(
        `Failed to execute CloudWatch Logs Insights query: ${error}`,
      );
    }
  }

  /**
   * Delete a log stream
   * @param logGroupName The name of the log group
   * @param logStreamName The name of the log stream
   * @param sessionId Session ID for credentials
   * @returns Status of the operation
   */
  async deleteLogStream(
    logGroupName: string,
    logStreamName: string,
    sessionId?: string,
  ): Promise<{ status: string; message: string }> {
    try {
      // Get client with session if provided
      const client = await getClientWithSessionAsync<CloudWatchLogsClient>(
        'cloudwatch-logs',
        this.region,
        this.cloudwatchLogsClient,
        sessionId,
        undefined,
        this.dynamoDBService,
      );

      // Delete the log stream
      const command = new DeleteLogStreamCommand({
        logGroupName,
        logStreamName,
      });

      await client.send(command);

      return {
        status: 'success',
        message: `Successfully deleted log stream ${logStreamName} in log group ${logGroupName}`,
      };
    } catch (error) {
      this.logger.error(
        `Error deleting log stream ${logStreamName} in log group ${logGroupName}: ${error}`,
      );
      throw new Error(`Failed to delete CloudWatch log stream: ${error}`);
    }
  }

  /**
   * Get time range with buffer for CloudWatch queries
   * @param config Configuration with sync job times
   * @returns Start and end times with buffer
   */
  private _getTimeRangeWithBuffer(config: any): {
    startTime?: number;
    endTime?: number;
  } {
    let startTime: number | undefined = undefined;
    let endTime: number | undefined = undefined;

    const parseDateTime = (timeStr: string): Date => {
      console.log(`Parsing time string: ${timeStr}`);

      try {
        // Try to parse the date string
        const dt = new Date(timeStr);
        if (!isNaN(dt.getTime())) {
          return dt;
        }
        throw new Error('Invalid date format');
      } catch (e) {
        console.error(`Error parsing datetime: ${e}`);
        throw new Error(`Unsupported datetime format: ${timeStr}`);
      }
    };

    if (config.syncJobStartTime) {
      // Convert string to timestamp and add buffer
      const dt = parseDateTime(config.syncJobStartTime);
      // Convert to milliseconds since epoch
      startTime = dt.getTime() - this.TIME_BUFFER_MS;
    }

    if (config.syncJobEndTime) {
      // Convert string to timestamp and add buffer
      const dt = parseDateTime(config.syncJobEndTime);
      // Convert to milliseconds since epoch
      endTime = dt.getTime() + this.TIME_BUFFER_MS;
    }

    console.log(`start time ${startTime} end time ${endTime}`);
    return {
      startTime,
      endTime,
    };
  }

  /**
   * Extract display name from group name
   * @param groupName Full group name
   * @returns Display name
   */
  private _extractDisplayName(groupName: string): string {
    // Handle SharePoint-style group names: "ID | Readable Name"
    if (groupName.includes(' | ')) {
      const parts = groupName.split(' | ');
      return parts[parts.length - 1]; // Return the last part (readable name)
    }

    // Handle other common patterns
    if (groupName.includes('/')) {
      const parts = groupName.split('/');
      return parts[parts.length - 1];
    }

    // Return as-is if no special pattern
    return groupName;
  }

  /**
   * Process group membership entries into structured groups
   * @param entries Raw group membership entries
   * @returns Structured groups with members
   */
  private _processGroupMembershipEntries(entries: any[]): Group[] {
    const groupsMap: Record<string, Group> = {};

    for (const entry of entries) {
      const groupName = entry.groupName;

      if (!groupsMap[groupName]) {
        groupsMap[groupName] = {
          groupName,
          displayName: this._extractDisplayName(groupName),
          isGroupFederated: entry.isGroupFederated === 'TRUE',
          members: {
            users: [],
            groups: [],
          },
          totalMembers: 0,
        };
      }

      const group = groupsMap[groupName];

      if (entry.memberType === 'USER') {
        // Check if user already exists to avoid duplicates
        const userExists = group.members.users.some(
          (user) => user.id === entry.memberName,
        );

        if (!userExists) {
          group.members.users.push({
            id: entry.memberName,
            email: entry.memberGlobalName,
            isFederated: entry.isMemberFederated === 'TRUE',
          });
          group.totalMembers += 1;
        }
      } else if (entry.memberType === 'GROUP') {
        // Check if group already exists to avoid duplicates
        const groupExists = group.members.groups.some(
          (subgroup) => subgroup.name === entry.memberName,
        );

        if (!groupExists) {
          group.members.groups.push({
            name: entry.memberName,
            displayName: this._extractDisplayName(entry.memberName),
            isFederated: entry.isMemberFederated === 'TRUE',
          });
          group.totalMembers += 1;
        }
      }
    }

    // Convert map to list and sort by display name
    const groups = Object.values(groupsMap);
    groups.sort((a, b) => a.displayName.localeCompare(b.displayName));

    return groups;
  }

  /**
   * Transform ACL structure for better organization
   * @param processedLogs Raw ACL log entries
   * @returns Transformed ACL documents
   */
  private _transformAclStructure(processedLogs: any[]): AclDocument[] {
    const groupedByDocument: Record<string, AclDocument> = {};

    for (const item of processedLogs) {
      const documentId = item.DocumentId;

      // If this DocumentId hasn't been processed yet, create the base structure
      if (!groupedByDocument[documentId]) {
        groupedByDocument[documentId] = {
          DocumentId: documentId,
          DocumentTitle: item.DocumentTitle,
          CrawlAction: item.CrawlAction,
          ConnectorDocumentStatus: item.ConnectorDocumentStatus,
          ACL: [],
        };
      }

      // Create ACL entry
      const aclEntry: AclEntry = {
        ACLEntityType: item.ACLEntityType,
        ACLEntityName: item.ACLEntityName,
        ACLEntityAccess: item.ACLEntityAccess,
        ACLUniqueIdentifier: item.ACLUniqueIdentifier,
        ACLEntityGlobalname: '',
      };

      if (item.ACLEntityGlobalname) {
        aclEntry.ACLEntityGlobalname = item.ACLEntityGlobalname;
      }

      // Add to ACL array
      groupedByDocument[documentId].ACL.push(aclEntry);
    }

    // Convert the grouped object back to an array
    return Object.values(groupedByDocument);
  }

  /**
   * Fetch group membership information from CloudWatch logs
   * @param config Configuration with application and sync job details
   * @param sessionId Session ID for credentials
   * @returns List of groups with members
   */
  async fetchGroupMembership(
    config: any,
    sessionId?: string,
  ): Promise<Group[]> {
    try {
      // Get client with session if provided
      const client = await getClientWithSessionAsync<CloudWatchLogsClient>(
        'cloudwatch-logs',
        this.region,
        this.cloudwatchLogsClient,
        sessionId,
        undefined,
        this.dynamoDBService,
      );

      const logEntries: any[] = [];
      let nextToken: string | undefined = undefined;

      const logGroupName = `/aws/qbusiness/${config.applicationId}`;
      // Use either syncJobId or syncJobExecutionId, whichever is available
      const syncJobId = config.syncJobId || config.syncJobExecutionId;
      const logStreamName = `GROUP_MEMBERSHIP/${config.dataSourceId}/${syncJobId}`;

      // Use the sync job's time range with buffer for efficient log fetching
      const timeRange = this._getTimeRangeWithBuffer(config);

      // Fetch all log entries
      do {
        const params: any = {
          logGroupName,
          logStreamNames: [logStreamName],
        };

        if (timeRange.startTime) {
          params.startTime = timeRange.startTime;
        }

        if (timeRange.endTime) {
          params.endTime = timeRange.endTime;
        }

        if (nextToken) {
          params.nextToken = nextToken;
        }

        const command = new FilterLogEventsCommand(params);
        const response = await client.send(command);

        if (response.events) {
          for (const event of response.events) {
            if (event.message) {
              try {
                // Parse the JSON message
                const entry = JSON.parse(event.message);
                logEntries.push(entry);
              } catch (e) {
                this.logger.error(
                  `Failed to parse group membership event: ${e}`,
                );
              }
            }
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);

      this.logger.log(
        `Fetched ${logEntries.length} group membership entries for sync job ${config.syncJobExecutionId}`,
      );

      // Process log entries into structured groups
      return this._processGroupMembershipEntries(logEntries);
    } catch (error) {
      this.logger.error(`Error fetching group membership: ${error}`);
      throw new Error(`Failed to fetch group membership: ${error}`);
    }
  }

  /**
   * Fetch ACL documents from CloudWatch logs
   * @param config Configuration with application and sync job details
   * @param sessionId Session ID for credentials
   * @returns List of documents with ACL information
   */
  async fetchAclDocuments(
    config: any,
    sessionId?: string,
  ): Promise<AclDocument[]> {
    try {
      console.log(`Fetching ACL with config ${JSON.stringify(config)}`);

      // Get client with session if provided
      const client = await getClientWithSessionAsync<CloudWatchLogsClient>(
        'cloudwatch-logs',
        this.region,
        this.cloudwatchLogsClient,
        sessionId,
        undefined,
        this.dynamoDBService,
      );

      const documents: AclDocument[] = [];
      let nextToken: string | undefined = undefined;

      // Determine log group name based on config
      let logGroupName: string;
      if (config.applicationId) {
        logGroupName = `/aws/qbusiness/${config.applicationId}`;
      } else {
        logGroupName = `/aws/kendra/${config.indexId}`;
      }

      // Use either syncJobId or syncJobExecutionId, whichever is available
      const syncJobId = config.syncJobId;
      const logStreamName = `SYNC_RUN_HISTORY_REPORT/${config.dataSourceId}/${syncJobId}`;

      // Use the sync job's time range with buffer for efficient log fetching
      console.log(`using config to fetch ${JSON.stringify(config)}`);
      const timeRange = this._getTimeRangeWithBuffer(config);

      // Fetch all log entries
      do {
        const params: any = {
          logGroupName,
          logStreamNamePrefix: logStreamName,
          limit: 200,
        };

        if (timeRange.startTime) {
          params.startTime = timeRange.startTime;
        }

        if (timeRange.endTime) {
          params.endTime = timeRange.endTime;
        }

        if (nextToken) {
          params.nextToken = nextToken;
        }

        console.log(`Fetching ACL with params ${JSON.stringify(params)}`);

        if (params.startTime === undefined || params.endTime === undefined) {
          console.log(
            `Start Time and End Time was not specified, will not fetch logs`,
          );
          return documents;
        }

        const command = new FilterLogEventsCommand(params);
        const response = await client.send(command);

        const processedLogs: any[] = [];
        if (response.events) {
          for (const event of response.events) {
            if (event.message) {
              try {
                const logEntry = JSON.parse(event.message);

                // Check if the log_entry contains 'Acl' property before extracting
                if (logEntry.Acl) {
                  const aclJson = JSON.parse(logEntry.Acl);

                  for (const acl of aclJson) {
                    processedLogs.push({
                      DocumentId: logEntry.DocumentId,
                      DocumentTitle: logEntry.DocumentTitle,
                      CrawlAction: logEntry.CrawlAction,
                      ConnectorDocumentStatus:
                        logEntry.ConnectorDocumentStatus?.Status,
                      ACLEntityGlobalname: acl.globalName,
                      ACLEntityName: acl.name,
                      ACLEntityType: acl.type,
                      ACLEntityAccess: acl.access,
                      ACLUniqueIdentifier: `${logEntry.DocumentId}#${acl.type}#${acl.name}`,
                    });
                  }
                }
              } catch (e) {
                this.logger.error(`Failed to parse ACL document: ${e}`);
              }
            }
          }
        }

        const transformed = this._transformAclStructure(processedLogs);
        documents.push(...transformed);

        nextToken = response.nextToken;
      } while (nextToken);

      this.logger.log(
        `Fetched ${documents.length} ACL documents for sync job ${config.syncJobExecutionId}`,
      );
      return documents;
    } catch (error) {
      this.logger.error(`Error fetching ACL documents: ${error}`);
      throw new Error(`Failed to fetch ACL documents: ${error}`);
    }
  }

  /**
   * Fetch sync errors from CloudWatch logs
   * @param config Configuration with application and sync job details
   * @param sessionId Session ID for credentials
   * @returns List of sync errors
   */
  async fetchSyncErrors(config: any, sessionId?: string): Promise<any[]> {
    try {
      // Get client with session if provided
      const client = await getClientWithSessionAsync<CloudWatchLogsClient>(
        'cloudwatch-logs',
        this.region,
        this.cloudwatchLogsClient,
        sessionId,
        undefined,
        this.dynamoDBService,
      );

      const errors: any[] = [];
      let nextToken: string | undefined = undefined;

      // Determine log group name based on config
      let logGroupName: string;
      if (config.applicationId) {
        logGroupName = `/aws/qbusiness/${config.applicationId}`;
      } else {
        logGroupName = `/aws/kendra/${config.indexId}`;
      }

      const logStreamPrefix = config.dataSourceId;
      const filterPattern =
        '{ $.DocumentId != "" && ($.LogLevel = Error || $.ErrorCode != "")}';

      // Use the sync job's time range with buffer for efficient log fetching
      const timeRange = this._getTimeRangeWithBuffer(config);

      // Fetch all log entries
      do {
        const params: any = {
          logGroupName,
          logStreamNamePrefix: logStreamPrefix,
          filterPattern,
        };

        if (timeRange.startTime) {
          params.startTime = timeRange.startTime;
        }

        if (timeRange.endTime) {
          params.endTime = timeRange.endTime;
        }

        if (nextToken) {
          params.nextToken = nextToken;
        }

        const command = new FilterLogEventsCommand(params);
        const response = await client.send(command);

        if (response.events) {
          for (const event of response.events) {
            if (event.message) {
              try {
                // Parse the JSON message
                const errorData = JSON.parse(event.message);

                // Ensure required fields exist
                if (
                  errorData.DocumentId &&
                  (errorData.ErrorCode || errorData.LogLevel === 'Error')
                ) {
                  errors.push({
                    ...errorData,
                    timestamp: event.timestamp,
                  });
                }
              } catch (e) {
                this.logger.error(`Failed to parse error event: ${e}`);
              }
            }
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);

      this.logger.log(
        `Fetched ${errors.length} errors for sync job ${config.syncJobId}`,
      );
      return errors;
    } catch (error) {
      this.logger.error(`Error fetching sync errors: ${error}`);
      throw new Error(`Failed to fetch sync errors: ${error}`);
    }
  }

  /**
   * Helper method to validate AWS configuration
   * @param sessionId Session ID for credentials
   * @returns True if configuration is valid, False otherwise
   */
  async validateConfiguration(sessionId?: string): Promise<boolean> {
    try {
      // Get client with session if provided
      const client = await getClientWithSessionAsync<CloudWatchLogsClient>(
        'cloudwatch-logs',
        this.region,
        this.cloudwatchLogsClient,
        sessionId,
        undefined,
        this.dynamoDBService,
      );

      // Try a simple operation to validate credentials
      const command = new DescribeLogGroupsCommand({ limit: 1 });
      await client.send(command);
      return true;
    } catch (error) {
      this.logger.error(
        `AWS CloudWatch configuration validation failed: ${error}`,
      );
      return false;
    }
  }
}
