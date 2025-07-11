// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { API_BASE_URL } from '../../constants/apiConstants';
import { ServiceResult } from '../service.types';

// Types that match the backend API responses and requests
export interface CredentialExchangeRequest {
  idToken: string;
}

export interface UserInfo {
  sub?: string;
  email?: string;
  name?: string;
}

export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  region: string;
}

export interface SessionInfo {
  sessionId: string;
  credentials: AWSCredentials;
  userInfo?: UserInfo;
  createdAt?: string;
  expiry?: string;
  additionalData?: any;
}

/**
 * CredentialExchangeProxyService - A service to proxy credential exchange requests to the backend API
 */
export class CredentialExchangeProxyService {
  private static instance: CredentialExchangeProxyService;
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
                data: await response.json().catch(() => ({})),
              },
            };
          }

          return { data: await response.json() };
        } catch (error) {
          console.error('API request failed:', error);
          throw error;
        }
      },
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
                data: await response.json().catch(() => ({})),
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
   * Get singleton instance of CredentialExchangeProxyService
   */
  public static getInstance(): CredentialExchangeProxyService {
    if (!CredentialExchangeProxyService.instance) {
      CredentialExchangeProxyService.instance = new CredentialExchangeProxyService();
    }
    return CredentialExchangeProxyService.instance;
  }

  /**
   * Exchange an ID token for AWS credentials and store in DynamoDB
   * @param request - The credential exchange request parameters
   * @returns ServiceResult with session information
   */
  public async exchangeCredentials(
    request: CredentialExchangeRequest,
  ): Promise<ServiceResult<SessionInfo>> {
    try {
      const response = await this.apiClient.post('/api/credentials/exchange', request);

      // Store the session ID under the cognito-session-id key
      if (response.data && response.data.sessionId) {
        console.log('exchange success')
        localStorage.setItem('cognito-session-id', response.data.sessionId);
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.log('exchange failure')
      return {
        success: false,
        error: {
          code: 'CredentialExchangeFailed',
          message: error.response?.data?.detail || 'Failed to exchange credentials',
          statusCode: error.response?.status || 500,
        },
      };
    }
  }

  /**
   * Get session information by session ID
   * @param sessionId - The session ID
   * @returns ServiceResult with session information
   */
  public async getSession(sessionId: string): Promise<ServiceResult<SessionInfo>> {
    try {
      const response = await this.apiClient.get(`/api/credentials/session/${sessionId}`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'GetSessionFailed',
          message: error.response?.data?.detail || 'Failed to get session information',
          statusCode: error.response?.status || 500,
        },
      };
    }
  }

  /**
   * Exchange for anonymous access using the QBUSINESS_ANONYMOUS_ACCESS_ROLE_ARN environment variable
   * @returns ServiceResult with session information
   */
  public async exchangeForAnonymousAccess(): Promise<ServiceResult<SessionInfo>> {
    try {
      const response = await this.apiClient.post(
        '/api/credentials/anonymous',
        {}, // Empty request body as the role ARN is now taken from environment variable
      );

      // Store the session ID under the cognito-session-id key
      if (response.data && response.data.sessionId) {
        localStorage.setItem('cognito-session-id', response.data.sessionId);
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'AnonymousAccessFailed',
          message: error.response?.data?.detail || 'Failed to exchange for anonymous access',
          statusCode: error.response?.status || 500,
        },
      };
    }
  }

  /**
   * Get the current session ID from localStorage
   * @returns The cognito session ID or null if not found
   */
  public getStoredSessionId(): string | null {
    return localStorage.getItem('cognito-session-id');
  }

  /**
   * Get the Cognito session ID from localStorage
   * @returns The Cognito session ID or null if not found
   */
  public getCognitoSessionId(): string | null {
    return localStorage.getItem('cognito-session-id');
  }

  /**
   * Check if there is a valid session stored
   * @returns True if a cognito session ID is stored, false otherwise
   */
  public hasStoredSession(): boolean {
    return !!this.getCognitoSessionId();
  }

  /**
   * Clear the stored cognito session ID
   */
  public clearStoredSession(): void {
    localStorage.removeItem('cognito-session-id');
  }
}

// Export a singleton instance
export const credentialExchangeProxyService = CredentialExchangeProxyService.getInstance();
