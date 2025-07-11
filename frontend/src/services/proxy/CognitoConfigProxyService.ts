// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { API_BASE_URL } from '../../constants/apiConstants';

/**
 * Service for fetching Cognito configuration from the backend
 */
export class CognitoConfigProxyService {
  /**
   * Fetch Cognito configuration from the backend
   * @param sessionId Optional session ID for authenticated requests
   * @returns Promise with the Cognito configuration
   */
  async fetchCognitoConfig(sessionId?: string): Promise<any> {
    try {
      // Construct the URL with optional session ID
      let url = `${API_BASE_URL}/api/config/cognito`;
      if (sessionId) {
        url += `?session_id=${sessionId}`;
      }

      // Make the API call
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch Cognito config: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Check if the response has the expected structure
      if (data.status === 'success' && data.config) {
        return data.config;
      } else {
        throw new Error('Invalid response format from Cognito config endpoint');
      }
    } catch (error) {
      console.error('Error fetching Cognito config:', error);
      throw error;
    }
  }
}

// Create a singleton instance
export const cognitoConfigProxyService = new CognitoConfigProxyService();
