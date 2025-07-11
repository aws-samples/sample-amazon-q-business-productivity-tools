// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Amazon Cognito Configuration
 *
 * This file contains the configuration for Amazon Cognito authentication.
 * Update these values with your own Cognito User Pool details.
 */

export const COGNITO_CONFIG = {
  // AWS Region where your Cognito User Pool is located
  REGION: 'us-east-1',

  // Cognito User Pool ID
  USER_POOL_ID: '',

  // Cognito App Client ID (without secret)
  CLIENT_ID: '',

  // Cognito domain prefix for hosted UI
  DOMAIN_PREFIX: '',

  // OAuth scopes to request
  OAUTH_SCOPES: ['openid', 'email', 'profile'],

  // Redirect URLs after sign-in and sign-out
  // These must match the URLs configured in your Cognito App Client settings
  REDIRECT_SIGN_IN: [window.location.origin],
  REDIRECT_SIGN_OUT: [window.location.origin],

  // Response type for authentication
  // 'token' for implicit flow (returns tokens directly)
  // 'code' for authorization code flow (requires client secret on backend)
  RESPONSE_TYPE: 'token',
};

/**
 * Local Storage Keys
 */
export const STORAGE_KEYS = {
  ID_TOKEN: 'cognito-id-token', // Specific key name for Cognito ID token
  ACCESS_TOKEN: 'access-token',
  REFRESH_TOKEN: 'refresh-token',
  USER_DATA: 'user-data',
};
