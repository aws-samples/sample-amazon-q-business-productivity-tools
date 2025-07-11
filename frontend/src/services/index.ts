// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Bedrock Service
export { BedrockService } from './BedrockService';
export type {
  FoundationModel,
  CustomModel,
  ModelCustomizationJob,
  EvaluationMetrics,
} from './BedrockService';

// Auth Service
export { AuthService } from './AuthService';
export type { AuthUser, AuthConfig } from './AuthService';

export type {} from // Re-export types from KendraService
'./KendraService';

// QBusiness Proxy Service
export { QBusinessProxyService, qBusinessProxyService } from './proxy/QBusinessProxyService';
// QBusiness Proxy Chat Service
export {
  QBusinessProxyChatService,
  qBusinessProxyChatService,
} from './proxy/QBusinessProxyChatService';

// S3 Proxy Service
export { S3ProxyService, s3ProxyService } from './proxy/S3ProxyService';

// Cognito Config Proxy Service
// export { CognitoConfigProxyService, cognitoConfigProxyService } from './proxy/CognitoConfigProxyService';
