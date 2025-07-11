// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Injectable, Logger } from '@nestjs/common';
import {
  DynamoDBClient,
  CreateTableCommand,
  ListTablesCommand,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';
import * as dotenv from 'dotenv';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

// Load environment variables
dotenv.config();

// Define interfaces for our return types
export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  expiration?: string;
}

export interface UserSession {
  sessionId: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  expiry?: string;
  createdAt: string;
  additionalData?: string;
}

@Injectable()
export class DynamoDBService {
  private readonly logger = new Logger(DynamoDBService.name);
  private readonly client: DynamoDBClient;
  private readonly region: string;
  private readonly tableName: string = 'UserSession';

  constructor() {
    // Get region from environment variables or use default
    this.region = process.env.AWS_REGION || 'us-east-1';

    // Initialize AWS client for DynamoDB
    this.client = new DynamoDBClient({ region: this.region });

    // Ensure the table exists
    this.createUserSessionTable();
  }

  /**
   * Create the UserSession table if it doesn't exist
   */
  async createUserSessionTable(): Promise<void> {
    try {
      // Check if table already exists
      try {
        const existingTablesResponse = await this.client.send(
          new ListTablesCommand({}),
        );
        const existingTables = existingTablesResponse.TableNames || [];
        this.logger.log(`Existing tables: ${existingTables.join(', ')}`);

        if (existingTables.includes(this.tableName)) {
          this.logger.log(`Table ${this.tableName} already exists`);
          return;
        }
      } catch (e) {
        this.logger.error(`Error listing tables: ${e}`);
        this.logger.warn(
          'Proceeding with table creation attempt despite listing error',
        );
      }
    } catch (e) {
      this.logger.error(`Error in createUserSessionTable: ${e}`);
      this.logger.warn('Will attempt to continue without table creation');
    }
  }

  /**
   * Store user session information in DynamoDB
   * @param sessionId Unique identifier for the session
   * @param credentials AWS credentials (accessKeyId, secretAccessKey, sessionToken)
   * @param expiry ISO format timestamp for credential expiry
   * @param createdAt ISO format timestamp for session creation
   * @param additionalData Any additional session data
   * @returns The stored session item
   */
  async storeUserSession(
    sessionId: string,
    credentials: AwsCredentials,
    expiry?: string,
    createdAt?: string,
    additionalData?: Record<string, any>,
  ): Promise<UserSession> {
    try {
      this.logger.log(
        `Storing session information for session ID: ${sessionId}`,
      );

      // Set default values if not provided
      if (!createdAt) {
        createdAt = new Date().toISOString();
      }

      if (!expiry && credentials.expiration) {
        expiry = credentials.expiration;
      }

      // Prepare the item to store
      const item: UserSession = {
        sessionId,
        accessKeyId: credentials.accessKeyId || '',
        secretAccessKey: credentials.secretAccessKey || '',
        sessionToken: credentials.sessionToken,
        expiry,
        createdAt,
      };

      // Add additional data if provided
      if (additionalData) {
        item.additionalData = JSON.stringify(additionalData);
      }

      // Put the item in the table
      const putItemCommand = new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(item),
      });

      await this.client.send(putItemCommand);

      this.logger.log(
        `Session stored successfully for session ID: ${sessionId}`,
      );
      return item;
    } catch (e) {
      this.logger.error(`Error storing session: ${e}`);
      throw e;
    }
  }

  /**
   * Retrieve user session information from DynamoDB
   * @param sessionId Unique identifier for the session
   * @returns The session item or null if not found
   */
  async getUserSession(sessionId: string): Promise<UserSession | null> {
    try {
      if (!sessionId) {
        this.logger.warn('Session ID is empty or null');
        return null;
      }

      this.logger.log(
        `Retrieving session information for session ID: ${sessionId}`,
      );

      // Ensure sessionId is a string
      const sessionIdStr = String(sessionId);

      this.logger.log(`Using session ID: ${sessionIdStr} to query DynamoDB`);

      // Get the item
      const getItemCommand = new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({
          sessionId: sessionIdStr,
        }),
      });

      const response = await this.client.send(getItemCommand);

      this.logger.log(`Response from DynamoDB: ${JSON.stringify(response)}`);

      // Check if the item exists
      if (response.Item) {
        const item = unmarshall(response.Item) as UserSession;

        // Parse additional data if it exists
        if (item.additionalData) {
          try {
            const additionalData = JSON.parse(item.additionalData);
            item.additionalData = JSON.stringify(additionalData);
          } catch (error) {
            this.logger.warn(
              `Failed to parse additionalData for session ID: ${sessionId}`,
            );
          }
        }

        this.logger.log(
          `Session retrieved successfully for session ID: ${sessionId}`,
        );
        return item;
      } else {
        this.logger.warn(`No session found for session ID: ${sessionId}`);
        return null;
      }
    } catch (e) {
      this.logger.error(`Error retrieving session: ${e}`);
      throw e;
    }
  }

  /**
   * Extract AWS credentials from a session
   * @param sessionId Unique identifier for the session
   * @returns AWS credentials or null if session not found or invalid
   */
  async getCredentialsFromSession(
    sessionId: string,
  ): Promise<AwsCredentials | null> {
    try {
      // Get the session
      const session = await this.getUserSession(sessionId);

      // Check if session exists
      if (!session) {
        this.logger.warn(`Session not found: ${sessionId}`);
        return null;
      }

      // Extract credentials
      const credentials: AwsCredentials = {
        accessKeyId: session.accessKeyId || '',
        secretAccessKey: session.secretAccessKey || '',
        sessionToken: session.sessionToken,
        expiration: session.expiry,
      };

      this.logger.log(`Credentials retrieved for session ID: ${sessionId}`);

      return credentials;
    } catch (e) {
      this.logger.error(`Error extracting credentials from session: ${e}`);
      return null;
    }
  }
}
