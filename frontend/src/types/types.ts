// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Sync Error types
// export interface SyncError {
//     DocumentId: string;
//     DocumentTitle?: string;
//     ErrorCode: string;
//     ErrorMessage: string;
//     LogLevel: string;
//     IndexId?: string;
//     DataSourceId?: string;
//     DataSourceSyncExecutionId?: string;
//     timestamp?: number;
// }
// Configuration types
// export interface Config {
//     qbusinessApplicationId: string;
//     indexId: string;
//     dataSourceId: string;
//     syncJobExecutionId: string;
//     syncJobStartTime?: string;  // ISO string format
//     syncJobEndTime?: string;    // ISO string format
// }

export interface BaseConfig {
  type: 'QBUSINESS' | 'KENDRA';
}

export interface QBusinessConfig extends BaseConfig {
  type: 'QBUSINESS';
  applicationId: string;
  indexId: string;
  retrieverId: string;
  dataSourceId: string;
  syncJobExecutionId: string;
  syncJobId?: string; // Added for compatibility with ApplicationConfigSelector
  syncJobStartTime?: string;
  syncJobEndTime?: string;
}

export interface KendraConfig extends BaseConfig {
  type: 'KENDRA';
  applicationId: string;
  indexId: string;
  dataSourceId: string;
  syncJobExecutionId: string;
  syncJobId?: string; // Added for compatibility with ApplicationConfigSelector
  syncJobStartTime?: string;
  syncJobEndTime?: string;
}

export type Config = QBusinessConfig | KendraConfig;

// AWS Resource types
export interface Application {
  applicationId: string;
  displayName: string;
  createdAt?: Date;
  updatedAt?: Date;
  status?: string;
}

export interface Index {
  indexId: string;
  displayName: string;
  createdAt?: Date;
  updatedAt?: Date;
  status?: string;
}

export interface DataSource {
  id: string;
  name: string;
  type?: string;
  status?: string;
  createdAt?: Date;
}

export interface SyncJob {
  executionId: string;
  displayName: string;
  startTime: Date;
  endTime?: Date;
  status: string;
  metrics?: SyncJobMetrics;
}

// Sync Job types
export interface SyncJobMetrics {
  documentsAdded?: number;
  documentsModified?: number;
  documentsDeleted?: number;
  documentsFailed?: number;
  documentsScanned?: number;
}

// Document types
export interface Document {
  DocumentId: string;
  DocumentTitle: string;
  CrawlAction?: string;
  ConnectorDocumentStatus?: DocumentStatus | string;
  CrawlStatus?: Status;
  SyncStatus?: Status;
  Acl?: ACL;
  ACL?: ACLEntity[];
  ErrorCode?: string;
  ErrorMessage?: string;
  Timestamp?: string;
}

export interface DocumentStatus {
  Status: 'SUCCESS' | 'ERROR' | 'PROCESSING';
  ErrorCode?: string;
  ErrorMessage?: string;
}

export interface Status {
  Status: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS';
  Message?: string;
}

export interface ACL {
  AllowGroups?: string[];
  AllowUsers?: string[];
  DenyGroups?: string[];
  DenyUsers?: string[];
}

export interface ACLEntity {
  ACLEntityType: 'USER' | 'GROUP';
  ACLEntityName: string;
  ACLEntityAccess: 'ALLOW' | 'DENY';
  ACLUniqueIdentifier: string;
  ACLEntityGlobalname?: string;
}

// Group Membership types
export interface GroupMembership {
  groupId: string;
  groupName?: string;
  members: GroupMember[];
  timestamp?: string;
}

export interface GroupMember {
  userId: string;
  email?: string;
  name?: string;
}

export interface GroupMembershipLogEntry {
  groupName: string;
  memberName: string;
  memberGlobalName?: string;
  memberType: 'USER' | 'GROUP';
  isMemberFederated: string;
  isGroupFederated: string;
}

export interface GroupWithMembers {
  groupName: string;
  displayName: string;
  isGroupFederated: boolean;
  members: {
    users: Array<{
      id: string;
      email?: string;
      isFederated: boolean;
    }>;
    groups: Array<{
      name: string;
      displayName: string;
      isFederated: boolean;
    }>;
  };
  totalMembers: number;
}

// Access Check types
export interface DocumentAccessCheck {
  documentId: string;
  documentTitle: string;
  userId: string;
  hasAccess: boolean;
  accessReason?: string;
  accessConfiguration?: AccessConfiguration;
}

export interface AccessConfiguration {
  allowedGroups?: string[];
  allowedUsers?: string[];
  deniedGroups?: string[];
  deniedUsers?: string[];
}

export interface AccessCheckResponse {
  hasAccess: boolean;
  documentAcl?: DocumentAcl;
  userAliases?: UserIdentity[];
  userGroups?: GroupIdentity[];
}

export interface DocumentAcl {
  allowlist?: AclList;
  denylist?: AclList;
}

export interface AclList {
  conditions?: AclCondition[];
  memberRelation?: 'AND' | 'OR';
}

export interface AclCondition {
  groups?: GroupIdentity[];
  users?: UserIdentity[];
  memberRelation?: 'AND' | 'OR';
}

export interface UserIdentity {
  id: string;
  type: 'DATASOURCE' | 'INDEX';
}

export interface GroupIdentity {
  name: string;
  type: 'DATASOURCE' | 'INDEX';
}

// Component Props types
export interface DashboardProps {
  config: Config;
  onConfigChange: () => void;
}

export interface ConfigScreenProps {
  onComplete: (config: Config) => void;
  initialConfig?: Config;
  onBackToTools?: () => void;
}

export interface TabComponentProps {
  config: Config;
}

// AWS Configuration types
export interface AWSConfigStatus {
  isValid: boolean;
  error?: string;
  details?: {
    hasCredentials: boolean;
    hasPermissions: boolean;
    region?: string;
  };
}

// UI State types
export interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
}

export interface FilterState {
  searchTerm: string;
  statusFilter?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

// Sync Error types
export interface SyncError {
  DocumentId: string;
  DocumentTitle?: string;
  ErrorCode: string;
  ErrorMessage: string;
  LogLevel: string;
  IndexId?: string;
  DataSourceId?: string;
  DataSourceSyncExecutionId?: string;
  timestamp?: number;
  SourceURI?: string;
}

// API Response types
export interface CloudWatchLogEvent {
  timestamp: number;
  message: string;
  logStreamName: string;
}

export interface ListDataSourceSyncJobsResponse {
  History: SyncJobHistory[];
  NextToken?: string;
}

export interface SyncJobHistory {
  ExecutionId: string;
  StartTime: Date;
  EndTime?: Date;
  Status: 'SUCCEEDED' | 'FAILED' | 'SYNCING' | 'INCOMPLETE';
  ErrorMessage?: string;
  ErrorCode?: string;
  DataSourceErrorCode?: string;
  Metrics?: SyncJobMetrics;
}
