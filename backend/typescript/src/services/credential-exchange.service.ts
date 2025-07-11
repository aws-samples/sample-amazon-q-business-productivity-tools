// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Injectable, Logger } from '@nestjs/common';
import {
  STSClient,
  AssumeRoleCommand,
  AssumeRoleWithWebIdentityCommand,
} from '@aws-sdk/client-sts';
import {
  SSOOIDCClient,
  CreateTokenWithIAMCommand,
} from '@aws-sdk/client-sso-oidc';
import { SSOClient } from '@aws-sdk/client-sso';
import * as dotenv from 'dotenv';
import * as uuid from 'uuid';
import * as jwt from 'jsonwebtoken';
import { DynamoDBService, AwsCredentials } from './dynamodb.service';

// Load environment variables
dotenv.config();

// Define interfaces for our return types
export interface UserInfo {
  sub: string;
  email: string;
  name: string;
}

export interface SessionInfo {
  sessionId: string;
  credentials: AwsCredentials;
  userInfo?: UserInfo;
  createdAt?: string;
  expiry?: string;
  additionalData?: any;
}

@Injectable()
export class CredentialExchangeService {
  private readonly logger = new Logger(CredentialExchangeService.name);
  private readonly stsClient: STSClient;
  private readonly ssoOidcClient: SSOOIDCClient;
  private readonly ssoClient: SSOClient;
  private readonly region: string;

  constructor(private readonly dynamoDBService: DynamoDBService) {
    // Get region from environment variables or use default
    this.region = process.env.AWS_REGION || 'us-east-1';

    // Initialize AWS clients
    this.stsClient = new STSClient({ region: this.region });
    this.ssoOidcClient = new SSOOIDCClient({ region: this.region });
    this.ssoClient = new SSOClient({ region: this.region });
  }

  /**
   * Exchange an ID token for AWS credentials and store in DynamoDB
   * @param idToken The ID token from the identity provider
   * @returns Session information including sessionId and credentials
   */
  async exchange(idToken: string): Promise<SessionInfo> {
    try {
      this.logger.log('Exchanging ID token for AWS credentials');

      // Decode the JWT token to extract information
      const tokenPayload = this.decodeJwtToken(idToken);

      this.logger.log('Decoded JWT token');

      // Generate a unique session ID
      const sessionId = uuid.v4();

      this.logger.log(`Creating new sessionId ${sessionId}`);

      // Get application ID and role ARN from environment variables
      const applicationId = process.env.IDENTITY_CENTER_APPLICATION_ID;
      const roleArn = process.env.IDENTITY_CENTER_APPLICATION_ROLE_ARN;

      if (!applicationId) {
        throw new Error(
          'IDENTITY_CENTER_APPLICATION_ID environment variable is not set',
        );
      }

      if (!roleArn) {
        throw new Error(
          'IDENTITY_CENTER_APPLICATION_ROLE_ARN environment variable is not set',
        );
      }

      // Exchange token for credentials
      const credentials = await this.exchangeWithSso(
        idToken,
        applicationId,
        roleArn,
      );

      // Store credentials in DynamoDB
      const createdAt = new Date().toISOString();
      const expiry = credentials.expiration;

      // Additional data to store with the session
      const additionalData = {
        userInfo: {
          sub: tokenPayload.sub || '',
          email: tokenPayload.email || '',
          name: tokenPayload.name || '',
        },
      };

      // Store session in DynamoDB
      await this.dynamoDBService.storeUserSession(
        sessionId,
        credentials,
        expiry,
        createdAt,
        additionalData,
      );

      // Return session information
      return {
        sessionId,
        credentials: {
          accessKeyId: credentials.accessKeyId || '',
          secretAccessKey: credentials.secretAccessKey || '',
          sessionToken: credentials.sessionToken || '',
          expiration: expiry,
        },
        userInfo: additionalData.userInfo,
      };
    } catch (error) {
      this.logger.error(`Error exchanging token: ${error}`);
      throw error;
    }
  }

  /**
   * Exchange for anonymous access using a role ARN
   * @param roleArn The role ARN to assume
   * @returns Session information including sessionId and credentials
   */
  async exchangeForAnonymousAccess(roleArn?: string): Promise<SessionInfo> {
    try {
      // If role ARN is not provided, get it from environment variables
      if (!roleArn) {
        roleArn = process.env.QBUSINESS_ANONYMOUS_ACCESS_ROLE_ARN;

        if (!roleArn) {
          throw new Error(
            'QBUSINESS_ANONYMOUS_ACCESS_ROLE_ARN environment variable is not set',
          );
        }
      }

      this.logger.log(`Exchanging for anonymous access with role: ${roleArn}`);

      // Generate a unique session ID
      const sessionId = uuid.v4();

      // Assume the role
      const assumeRoleInput = {
        RoleArn: roleArn,
        RoleSessionName: 'OneUnifiedAppSession',
      };

      this.logger.log(
        `Assuming role with input: ${JSON.stringify(assumeRoleInput)}`,
      );

      const command = new AssumeRoleCommand(assumeRoleInput);
      const assumeRoleResponse = await this.stsClient.send(command);

      if (!assumeRoleResponse.Credentials) {
        throw new Error('Failed to get credentials from assume role response');
      }

      // Extract credentials
      const credentials: AwsCredentials = {
        accessKeyId: assumeRoleResponse.Credentials.AccessKeyId || '',
        secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey || '',
        sessionToken: assumeRoleResponse.Credentials.SessionToken,
        expiration: assumeRoleResponse.Credentials.Expiration?.toISOString(),
      };

      // Store credentials in DynamoDB
      const createdAt = new Date().toISOString();
      const expiry = credentials.expiration;

      // Store session in DynamoDB
      await this.dynamoDBService.storeUserSession(
        sessionId,
        credentials,
        expiry,
        createdAt,
        { anonymous: true },
      );

      this.logger.log(`Returning from anonymous ${sessionId}`);

      // Return session information
      return {
        sessionId,
        credentials,
      };
    } catch (error) {
      this.logger.error(`Error exchanging for anonymous access: ${error}`);
      throw error;
    }
  }

  /**
   * Get session information by session ID
   * @param sessionId The session ID
   * @returns Session information or null if not found
   */
  async getSession(sessionId: string): Promise<SessionInfo | null> {
    try {
      // Get session from DynamoDB
      const session = await this.dynamoDBService.getUserSession(sessionId);

      if (!session) {
        return null;
      }

      // Extract credentials
      const credentials: AwsCredentials = {
        accessKeyId: session.accessKeyId || '',
        secretAccessKey: session.secretAccessKey || '',
        sessionToken: session.sessionToken,
        expiration: session.expiry,
      };

      // Parse additional data
      let additionalData = {};
      if (session.additionalData) {
        try {
          if (typeof session.additionalData === 'string') {
            additionalData = JSON.parse(session.additionalData);
          } else {
            additionalData = session.additionalData;
          }
        } catch (error) {
          this.logger.warn(
            `Failed to parse additionalData for session ID: ${sessionId}`,
          );
        }
      }

      // Return session information
      return {
        sessionId,
        credentials,
        createdAt: session.createdAt,
        expiry: session.expiry,
        additionalData,
      };
    } catch (error) {
      this.logger.error(`Error getting session: ${error}`);
      return null;
    }
  }

  /**
   * Check if a session is valid
   * @param sessionId The session ID
   * @returns True if session is valid, False otherwise
   */
  async isSessionValid(sessionId: string): Promise<boolean> {
    try {
      // Get the session
      const session = await this.dynamoDBService.getUserSession(sessionId);

      // Check if session exists
      if (!session) {
        return false;
      }

      // Check if session has expiry
      if (!session.expiry) {
        return false;
      }

      // Parse expiry timestamp
      try {
        const expiryTime = new Date(session.expiry);
        const currentTime = new Date();

        // Check if session is expired
        return expiryTime > currentTime;
      } catch (error) {
        this.logger.warn(`Invalid expiry format for session ID: ${sessionId}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Error checking session validity: ${error}`);
      return false;
    }
  }

  /**
   * Get credentials from a session
   * @param sessionId The session ID
   * @returns Credentials or null if session not found or invalid
   */
  async getCredentials(sessionId: string): Promise<AwsCredentials | null> {
    return this.dynamoDBService.getCredentialsFromSession(sessionId);
  }

  /**
   * Exchange an ID token for AWS credentials using SSO
   * @param idToken The ID token from the identity provider
   * @param applicationId The SSO application ID
   * @param roleArn The role ARN to assume
   * @returns AWS credentials
   */
  private async exchangeWithSso(
    idToken: string,
    applicationId: string,
    roleArn: string,
  ): Promise<AwsCredentials> {
    try {
      this.logger.log(`Exchanging with SSO for application ${applicationId}`);

      this.logger.log(`Using role ARN: ${roleArn}`);

      // Create token with IAM
      const createTokenInput = {
        clientId: applicationId,
        grantType: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: idToken,
      };

      this.logger.log(
        `Creating token with IAM using input: ${JSON.stringify(createTokenInput)}`,
      );

      const command = new CreateTokenWithIAMCommand(createTokenInput);
      const tokenResponse = await this.ssoOidcClient.send(command);

      this.logger.log('Token response received successfully');

      const idTokenFromIam = tokenResponse.idToken;

      if (!idTokenFromIam) {
        throw new Error('Failed to get ID token from IAM');
      }

      // Decode the token to get identity context
      const iamTokenPayload = this.decodeJwtToken(idTokenFromIam);
      const identityContext = iamTokenPayload['sts:identity_context'];

      if (!identityContext) {
        throw new Error('Failed to get identity context from token');
      }

      // Assume role with identity context
      const assumeRoleInput = {
        RoleArn: roleArn,
        RoleSessionName: 'OneUnifiedAppSession',
        ProvidedContexts: [
          {
            ProviderArn: 'arn:aws:iam::aws:contextProvider/IdentityCenter',
            ContextAssertion: identityContext,
          },
        ],
      };

      const assumeRoleCommand = new AssumeRoleCommand(assumeRoleInput);
      const assumeRoleResponse = await this.stsClient.send(assumeRoleCommand);

      if (!assumeRoleResponse.Credentials) {
        throw new Error('Failed to get credentials from assume role response');
      }

      // Extract credentials
      const credentials: AwsCredentials = {
        accessKeyId: assumeRoleResponse.Credentials.AccessKeyId || '',
        secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey || '',
        sessionToken: assumeRoleResponse.Credentials.SessionToken,
        expiration: assumeRoleResponse.Credentials.Expiration?.toISOString(),
      };

      return credentials;
    } catch (error) {
      this.logger.error(`Error exchanging with SSO: ${error}`);
      throw error;
    }
  }

  /**
   * Exchange an ID token for AWS credentials using direct STS assume role
   * @param idToken The ID token from the identity provider
   * @param roleArn The role ARN to assume
   * @param tokenPayload The decoded JWT token payload
   * @returns AWS credentials
   */
  private async exchangeWithSts(
    idToken: string,
    roleArn: string,
    tokenPayload: any,
  ): Promise<AwsCredentials> {
    try {
      // Assume role with web identity
      const assumeRoleInput = {
        RoleArn: roleArn,
        RoleSessionName: 'OneUnifiedAppSession',
        WebIdentityToken: idToken,
      };

      const command = new AssumeRoleWithWebIdentityCommand(assumeRoleInput);
      const assumeRoleResponse = await this.stsClient.send(command);

      if (!assumeRoleResponse.Credentials) {
        throw new Error('Failed to get credentials from assume role response');
      }

      // Extract credentials
      const credentials: AwsCredentials = {
        accessKeyId: assumeRoleResponse.Credentials.AccessKeyId || '',
        secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey || '',
        sessionToken: assumeRoleResponse.Credentials.SessionToken,
        expiration: assumeRoleResponse.Credentials.Expiration?.toISOString(),
      };

      return credentials;
    } catch (error) {
      this.logger.error(`Error exchanging with STS: ${error}`);
      throw error;
    }
  }

  /**
   * Decode a JWT token
   * @param token The JWT token to decode
   * @returns The decoded token payload
   */
  private decodeJwtToken(token: string): any {
    try {
      // Decode without verification (we're just extracting information)
      const payload = jwt.decode(token);
      return payload || {};
    } catch (error) {
      this.logger.error(`Error decoding JWT token: ${error}`);

      // Fallback to manual decoding if jwt library fails
      try {
        const parts = token.split('.');
        if (parts.length !== 3) {
          throw new Error('Invalid JWT token format');
        }

        // Decode the payload (second part)
        let payloadBase64 = parts[1];

        // Add padding if needed
        while (payloadBase64.length % 4 !== 0) {
          payloadBase64 += '=';
        }

        const payloadJson = Buffer.from(
          payloadBase64.replace(/-/g, '+').replace(/_/g, '/'),
          'base64',
        ).toString('utf8');

        const payload = JSON.parse(payloadJson);

        return payload;
      } catch (nestedError) {
        this.logger.error(`Error in fallback JWT decoding: ${nestedError}`);
        return {};
      }
    }
  }
}
