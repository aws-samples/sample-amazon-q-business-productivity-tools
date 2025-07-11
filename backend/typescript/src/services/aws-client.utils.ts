// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { QBusinessClient } from '@aws-sdk/client-qbusiness';
import { BedrockClient } from '@aws-sdk/client-bedrock';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import * as dotenv from 'dotenv';
import { Logger } from '@nestjs/common';
import { AwsCredentials as DbAwsCredentials } from './dynamodb.service';

// Load environment variables
dotenv.config();

// AWS SDK credential interface
interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  expiration?: Date;
}

// In-memory cache for credentials
// Structure: {session_id: {credentials: {...}, expiry: timestamp}}
interface CredentialsCacheEntry {
  credentials: DbAwsCredentials;
  expiry: number;
}

const credentialsCache: Record<string, CredentialsCacheEntry> = {};

// Cache TTL in seconds (default: 30 minutes)
const CACHE_TTL = 30 * 60;

/**
 * Get credentials for a session ID, using cache if available
 * @param sessionId Session ID to fetch credentials for
 * @param dynamoDBService DynamoDB service instance
 * @returns Credentials or null if not found
 */
export async function getCredentialsWithCache(
  sessionId: string,
  dynamoDBService: any,
): Promise<DbAwsCredentials | null> {
  const logger = new Logger('AwsClientUtils');
  const currentTime = Math.floor(Date.now() / 1000);

  // Check if credentials are in cache and not expired
  if (credentialsCache[sessionId]) {
    const cacheEntry = credentialsCache[sessionId];
    if (cacheEntry.expiry > currentTime) {
      logger.log(`Using cached credentials for session ID: ${sessionId}`);
      return cacheEntry.credentials;
    } else {
      // Remove expired entry
      logger.log(`Cached credentials expired for session ID: ${sessionId}`);
      delete credentialsCache[sessionId];
    }
  }

  try {
    // Get credentials from DynamoDB
    logger.log(
      `Fetching credentials from DynamoDB for session ID: ${sessionId}`,
    );
    const credentials =
      await dynamoDBService.getCredentialsFromSession(sessionId);

    if (credentials) {
      // Store in cache with expiry
      credentialsCache[sessionId] = {
        credentials,
        expiry: currentTime + CACHE_TTL,
      };
      logger.log(`Cached credentials for session ID: ${sessionId}`);
    }

    return credentials;
  } catch (e) {
    logger.error(`Error fetching credentials: ${e}`);
    return null;
  }
}

/**
 * Get AWS client with optional session credentials
 * @param clientType The AWS client type to create
 * @param region The AWS region
 * @param defaultClient The default client to use if no session is provided
 * @param sessionId Optional session ID to fetch credentials from DynamoDB
 * @param credentials Optional AWS credentials
 * @returns The AWS client
 */
export function getClientWithSession<T>(
  clientType: string,
  region: string,
  defaultClient: T,
  sessionId?: string,
  credentials?: DbAwsCredentials,
  dynamoDBService?: any,
): T {
  const logger = new Logger('AwsClientUtils');

  // If no session ID or credentials are provided, return the default client
  if (!sessionId && !credentials) {
    logger.log(`No session ID provided, using default ${clientType} client`);
    return defaultClient;
  }

  try {
    // Log the session ID we're trying to use
    if (sessionId) {
      logger.log(
        `Attempting to get ${clientType} client with session ID: ${sessionId}`,
      );

      // Check if the session ID is valid
      if (typeof sessionId !== 'string' || !sessionId.trim()) {
        logger.warn(
          `Invalid session ID format: ${sessionId}, using default ${clientType} client`,
        );
        return defaultClient;
      }

      // If we have a dynamoDBService, we can fetch credentials
      if (dynamoDBService) {
        // This would be handled asynchronously in a real implementation
        // For now, we'll just return the default client
        logger.log(
          `DynamoDB service provided, but async credential fetching not implemented in this function`,
        );
        logger.log(
          `Use the async version of this function or provide credentials directly`,
        );
      }
    }

    // If credentials are provided directly, use them
    if (credentials) {
      // Log credential details (without exposing sensitive info)
      logger.log(
        `Creating ${clientType} client with credentials: accessKeyId=${credentials.accessKeyId.substring(0, 4)}..., ` +
          `secretAccessKey=${credentials.secretAccessKey ? '****' : 'None'}, ` +
          `sessionToken=${credentials.sessionToken ? 'Present' : 'None'}`,
      );

      return createAwsClient(clientType, region, credentials);
    }

    // Return default client as fallback
    logger.warn(`Falling back to default ${clientType} client`);
    return defaultClient;
  } catch (e) {
    logger.error(`Error getting ${clientType} client with session: ${e}`);
    // Fall back to default client
    logger.warn(`Falling back to default ${clientType} client`);
    return defaultClient;
  }
}

/**
 * Async version of getClientWithSession that can fetch credentials from DynamoDB
 */
export async function getClientWithSessionAsync<T>(
  clientType: string,
  region: string,
  defaultClient: T,
  sessionId?: string,
  credentials?: DbAwsCredentials,
  dynamoDBService?: any,
): Promise<T> {
  const logger = new Logger('AwsClientUtils');

  // If no session ID or credentials are provided, return the default client
  if (!sessionId && !credentials) {
    logger.log(`No session ID provided, using default ${clientType} client`);
    return defaultClient;
  }

  try {
    // If session ID is provided and we have a dynamoDBService, fetch credentials
    if (sessionId && dynamoDBService) {
      logger.log(
        `Attempting to get ${clientType} client with session ID: ${sessionId}`,
      );

      // Check if the session ID is valid
      if (typeof sessionId !== 'string' || !sessionId.trim()) {
        logger.warn(
          `Invalid session ID format: ${sessionId}, using default ${clientType} client`,
        );
        return defaultClient;
      }

      // Get credentials from cache or DynamoDB
      const fetchedCredentials = await getCredentialsWithCache(
        sessionId,
        dynamoDBService,
      );
      logger.log(`Credentials fetch result: ${fetchedCredentials !== null}`);

      if (!fetchedCredentials) {
        logger.warn(
          `No valid credentials found for session ID: ${sessionId}, using default ${clientType} client`,
        );
        return defaultClient;
      }

      // Validate credentials
      if (
        !fetchedCredentials.accessKeyId ||
        !fetchedCredentials.secretAccessKey
      ) {
        logger.warn(
          `Incomplete credentials for session ID: ${sessionId}, using default ${clientType} client`,
        );
        return defaultClient;
      }

      // Log credential details (without exposing sensitive info)
      logger.log(
        `Creating ${clientType} client with credentials: accessKeyId=${fetchedCredentials.accessKeyId.substring(0, 4)}..., ` +
          `secretAccessKey=${fetchedCredentials.secretAccessKey ? '****' : 'None'}, ` +
          `sessionToken=${fetchedCredentials.sessionToken ? 'Present' : 'None'}`,
      );

      return createAwsClient(clientType, region, fetchedCredentials);
    }

    // If credentials are provided directly, use them
    if (credentials) {
      return createAwsClient(clientType, region, credentials);
    }

    // Return default client as fallback
    logger.warn(`Falling back to default ${clientType} client`);
    return defaultClient;
  } catch (e) {
    logger.error(`Error getting ${clientType} client with session: ${e}`);
    // Fall back to default client
    logger.warn(`Falling back to default ${clientType} client`);
    return defaultClient;
  }
}

/**
 * Create an AWS client with the specified credentials
 * @param clientType The AWS client type to create
 * @param region The AWS region
 * @param credentials The AWS credentials
 * @returns The AWS client
 */
export function createAwsClient<T>(
  clientType: string,
  region: string,
  credentials: DbAwsCredentials,
): T {
  // Convert our credentials format to AWS SDK format
  const awsCredentials: AwsCredentials = {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    sessionToken: credentials.sessionToken,
  };

  // Convert expiration string to Date if it exists
  if (credentials.expiration) {
    try {
      awsCredentials.expiration = new Date(credentials.expiration);
    } catch (e) {
      // If parsing fails, don't set expiration
      console.warn(
        `Failed to parse expiration date: ${credentials.expiration}`,
      );
    }
  }

  const clientConfig = {
    region,
    credentials: awsCredentials,
  };

  switch (clientType) {
    case 'dynamodb':
      return new DynamoDBClient(clientConfig) as unknown as T;
    case 's3':
      return new S3Client(clientConfig) as unknown as T;
    case 'cloudwatch-logs':
      return new CloudWatchLogsClient(clientConfig) as unknown as T;
    case 'qbusiness':
      return new QBusinessClient(clientConfig) as unknown as T;
    case 'bedrock':
      return new BedrockClient(clientConfig) as unknown as T;
    case 'secretsmanager':
      return new SecretsManagerClient(clientConfig) as unknown as T;
    default:
      throw new Error(`Unsupported client type: ${clientType}`);
  }
}
