// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Injectable, Logger } from '@nestjs/common';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import * as dotenv from 'dotenv';
import { getClientWithSessionAsync } from './aws-client.utils';
import { DynamoDBService } from './dynamodb.service';

// Load environment variables
dotenv.config();

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);
  private readonly secretsManagerClient: SecretsManagerClient;
  private readonly region: string;

  constructor(private readonly dynamoDBService: DynamoDBService) {
    // Get region from environment variables or use default
    this.region = process.env.AWS_REGION || 'us-east-1';

    // Initialize AWS client for SecretsManager
    this.secretsManagerClient = new SecretsManagerClient({
      region: this.region,
    });
  }

  /**
   * Get a SecretsManager client, optionally using credentials from a session
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns A client for the SecretsManager service
   */
  async getClient(sessionId?: string): Promise<SecretsManagerClient> {
    return getClientWithSessionAsync<SecretsManagerClient>(
      'secretsmanager',
      this.region,
      this.secretsManagerClient,
      sessionId,
      undefined,
      this.dynamoDBService,
    );
  }

  /**
   * Get Cognito configuration from AWS Secrets Manager
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns Cognito configuration values
   */
  async getCognitoConfig(sessionId?: string): Promise<any> {
    try {
      this.logger.log('Getting Cognito configuration from Secrets Manager');

      const client = await this.getClient(sessionId);

      // Get the secret value
      const command = new GetSecretValueCommand({
        SecretId: 'QBusinessCognitoConfig',
      });

      const response = await client.send(command);

      // Parse the secret string
      if (response.SecretString) {
        const config = JSON.parse(response.SecretString);

        // Remove the dummy key if it exists
        if (config.dummy) {
          delete config.dummy;
        }

        this.logger.log('Successfully retrieved Cognito configuration');
        return {
          status: 'success',
          config,
        };
      } else {
        this.logger.error('Secret value does not contain SecretString');
        return {
          status: 'error',
          message: 'Secret value does not contain SecretString',
        };
      }
    } catch (error) {
      this.logger.error(`Error retrieving Cognito config: ${error}`);
      return {
        status: 'error',
        message: `Failed to retrieve Cognito configuration: ${error.message}`,
      };
    }
  }
}
