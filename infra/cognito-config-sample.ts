// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Amazon Cognito Configuration Sample
 * 
 * This file contains a sample configuration for Amazon Cognito authentication.
 * After deploying the CognitoStack, replace the values in frontend/src/constants/cognitoConfig.ts
 * with the values from the CloudFormation outputs.
 */

export const COGNITO_CONFIG = {
  // AWS Region where your Cognito User Pool is located
  // Replace with the region where you deployed the CognitoStack
  REGION: 'us-east-1',
  
  // Cognito User Pool ID
  // Replace with the value from CognitoStack output 'CognitoUserPoolId'
  USER_POOL_ID: 'us-east-1_xxxxxxxxx',
  
  // Cognito App Client ID (without secret)
  // Replace with the value from CognitoStack output 'CognitoUserPoolClientId'
  CLIENT_ID: 'xxxxxxxxxxxxxxxxxxxxxxxxxx',
  
  // Cognito domain prefix for hosted UI
  // Replace with the value from CognitoStack output 'CognitoUserPoolDomainPrefix'
  DOMAIN_PREFIX: 'qbusiness-xxxxxxxx',
  
  // OAuth scopes to request
  OAUTH_SCOPES: ['openid', 'email', 'profile'],
  
  // Redirect URLs after sign-in and sign-out
  // These must match the URLs configured in your Cognito App Client settings
  // For local development, use 'http://localhost:3000'
  // For production, use your CloudFront distribution URL
  REDIRECT_SIGN_IN: ['http://localhost:3000'],
  REDIRECT_SIGN_OUT: ['http://localhost:3000'],
  
  // Response type for authentication
  // 'token' for implicit flow (returns tokens directly)
  // 'code' for authorization code flow (requires client secret on backend)
  RESPONSE_TYPE: 'token'
};

/**
 * Local Storage Keys
 */
export const STORAGE_KEYS = {
  ID_TOKEN: 'cognito-id-token', // Specific key name for Cognito ID token
  ACCESS_TOKEN: 'access-token',
  REFRESH_TOKEN: 'refresh-token',
  USER_DATA: 'user-data'
};

/**
 * How to use this configuration:
 * 
 * 1. Deploy the CognitoStack using AWS CDK:
 *    cd infra
 *    npm run cdk deploy CognitoStack
 * 
 * 2. Note the outputs from the deployment:
 *    - CognitoUserPoolId
 *    - CognitoUserPoolClientId
 *    - CognitoUserPoolDomainPrefix
 * 
 * 3. Update the frontend/src/constants/cognitoConfig.ts file with these values
 * 
 * 4. Make sure your application's URL (e.g., http://localhost:3000 for local development
 *    or your CloudFront distribution URL for production) is added to the Cognito User Pool
 *    App Client's callback URLs and logout URLs.
 */
