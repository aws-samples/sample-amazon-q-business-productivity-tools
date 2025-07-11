// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Common service types used across multiple services
 */

// AWS Credentials
export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

// AWS Region
export type AWSRegion = string;

// Service Configuration
export interface ServiceConfig {
  credentials?: AWSCredentials;
  region?: AWSRegion;
  endpoint?: string;
}

// QBusiness Configuration
export interface QBusinessConfig {
  qbusinessApplicationId: string;
  indexId: string;
  dataSourceId: string;
  syncJobExecutionId: string;
}

// Document Interface
export interface Document {
  DocumentId: string;
  DocumentTitle: string;
  CrawlAction?: string;
  ConnectorDocumentStatus?: any;
  CrawlStatus?: any;
  SyncStatus?: any;
  Acl?: any;
  ErrorCode?: string;
  ErrorMessage?: string;
}

// Group Membership
export interface GroupMembership {
  groupId: string;
  members: string[];
}

// Pagination Parameters
export interface PaginationParams {
  maxResults?: number;
  nextToken?: string;
}

// Common Response with Pagination
export interface PaginatedResponse<T> {
  items: T[];
  nextToken?: string;
}

// Error Response
export interface ErrorResponse {
  code: string;
  message: string;
  requestId?: string;
  statusCode?: number;
}

// Service Operation Result
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: ErrorResponse;
}

// Date Range
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

// Common Status Types
export type ResourceStatus = 'CREATING' | 'ACTIVE' | 'UPDATING' | 'DELETING' | 'FAILED';
export type JobStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

// Authentication Types
export interface AuthToken {
  token: string;
  expiresAt: Date;
  tokenType: string;
}

// Common Metrics
export interface MetricValue {
  timestamp: Date;
  value: number;
  unit?: string;
}

// Resource Tags
export interface ResourceTag {
  key: string;
  value: string;
}
