// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * ACL Viewer Component
 *
 * This is the consolidated version of the ACLViewerComponent.
 * The duplicate version in /src/components/ACLViewerComponent.tsx
 * has been removed to avoid code duplication.
 *
 * This component displays Access Control List (ACL) information for documents
 * from a specified sync job, showing which users and groups have access to each document.
 */
import {
  Search,
  FileText,
  Clock,
  AlertCircle,
  Loader2,
  RefreshCw,
  Users,
  User,
  Shield,
  ShieldOff,
} from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

import { cloudWatchProxyService } from '../../services/proxy/CloudWatchProxyService';
import { Config, Document, ACLEntity } from '../../types/types';
import { getRelativeTime } from '../../utils/timeUtils';
import ACLSummary from '../ACLSummary';

interface ACLViewerComponentProps {
  config: Config;
}

const ACLViewerComponent: React.FC<ACLViewerComponentProps> = ({ config }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocs, setFilteredDocs] = useState<Document[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await cloudWatchProxyService.fetchACLDocuments(config);
      if (response.success && response.data) {
        setDocuments(response.data);
        setFilteredDocs(response.data);
      } else {
        throw new Error(response.error?.message || 'Failed to fetch ACL documents');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch ACL documents');
      console.error('Error fetching ACL documents:', err);
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    const filtered = documents.filter(
      (doc) =>
        doc.DocumentTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.DocumentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.ACL?.some(
          (acl) =>
            acl.ACLEntityGlobalname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            acl.ACLEntityName?.toLowerCase().includes(searchTerm.toLowerCase()),
        ),
    );
    setFilteredDocs(filtered);
    setCurrentPage(1);
  }, [searchTerm, documents]);

  const totalPages = Math.ceil(filteredDocs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayedDocs = filteredDocs.slice(startIndex, startIndex + itemsPerPage);

  // Helper function to group ACL entities
  const groupACLEntities = (acl: ACLEntity[]) => {
    const groups = {
      allowedUsers: [] as ACLEntity[],
      allowedGroups: [] as ACLEntity[],
      deniedUsers: [] as ACLEntity[],
      deniedGroups: [] as ACLEntity[],
    };

    acl.forEach((entity) => {
      if (entity.ACLEntityType === 'USER' && entity.ACLEntityAccess === 'ALLOW') {
        groups.allowedUsers.push(entity);
      } else if (entity.ACLEntityType === 'GROUP' && entity.ACLEntityAccess === 'ALLOW') {
        groups.allowedGroups.push(entity);
      } else if (entity.ACLEntityType === 'USER' && entity.ACLEntityAccess === 'DENY') {
        groups.deniedUsers.push(entity);
      } else if (entity.ACLEntityType === 'GROUP' && entity.ACLEntityAccess === 'DENY') {
        groups.deniedGroups.push(entity);
      }
    });

    return groups;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="w-12 h-12 text-purple-400 animate-spin mb-4" />
        <p className="text-gray-400">Loading ACL documents...</p>
        {config.syncJobStartTime && (
          <p className="text-sm text-gray-500 mt-2">
            Searching logs from {getRelativeTime(config.syncJobStartTime)}
          </p>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-red-400" />
          <h3 className="text-lg font-semibold text-red-400">Error Loading ACL Documents</h3>
        </div>
        <p className="text-gray-300 mb-4">{error}</p>
        <button
          onClick={fetchDocuments}
          className="flex items-center gap-2 px-4 py-2 bg-red-800/30 hover:bg-red-800/50 rounded-lg transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-3xl font-bold mb-2">ACL Viewer</h2>
          <p className="text-gray-400">
            {documents.length} document{documents.length !== 1 ? 's' : ''} found in sync job
          </p>
        </div>

        {/* Time info */}
        {config.syncJobStartTime && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Clock className="w-4 h-4" />
            <span>Sync ran {getRelativeTime(config.syncJobStartTime)}</span>
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search documents, users, or groups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:border-purple-500 focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* Documents List */}
      <div className="space-y-4">
        {displayedDocs.length === 0 ? (
          <div className="text-center py-12 bg-gray-900/50 backdrop-blur-lg rounded-lg border border-gray-800">
            <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">
              {searchTerm
                ? 'No documents match your search'
                : 'No documents found in this sync job'}
            </p>
          </div>
        ) : (
          displayedDocs.map((doc) => {
            const aclGroups = doc.ACL ? groupACLEntities(doc.ACL) : null;

            return (
              <div
                key={doc.DocumentId}
                className="bg-gray-900/50 backdrop-blur-lg rounded-lg p-6 border border-gray-800 hover:border-purple-500/50 transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">
                      {doc.DocumentTitle || 'Untitled Document'}
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">ID: {doc.DocumentId}</p>
                    {doc.CrawlAction && (
                      <p className="text-xs text-gray-500 mt-1">Action: {doc.CrawlAction}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.ConnectorDocumentStatus && (
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          (typeof doc.ConnectorDocumentStatus === 'string'
                            ? doc.ConnectorDocumentStatus
                            : doc.ConnectorDocumentStatus.Status) === 'SUCCESS'
                            ? 'bg-green-900/30 text-green-400'
                            : (typeof doc.ConnectorDocumentStatus === 'string'
                                  ? doc.ConnectorDocumentStatus
                                  : doc.ConnectorDocumentStatus.Status) === 'FAILED'
                              ? 'bg-red-900/30 text-red-400'
                              : 'bg-yellow-900/30 text-yellow-400'
                        }`}
                      >
                        {typeof doc.ConnectorDocumentStatus === 'string'
                          ? doc.ConnectorDocumentStatus
                          : doc.ConnectorDocumentStatus.Status || 'UNKNOWN'}
                      </span>
                    )}
                  </div>
                </div>

                {aclGroups && doc.ACL && (
                  <div className="space-y-4">
                    {/* ACL Summary */}
                    <ACLSummary acl={doc.ACL} />

                    {/* Allowed Access */}
                    {(aclGroups.allowedUsers.length > 0 || aclGroups.allowedGroups.length > 0) && (
                      <div className="border border-green-900/30 rounded-lg p-4 bg-green-900/10">
                        <div className="flex items-center gap-2 mb-3">
                          <Shield className="w-4 h-4 text-green-400" />
                          <h4 className="text-sm font-medium text-green-400">Allowed Access</h4>
                        </div>

                        {aclGroups.allowedUsers.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs text-gray-400 mb-2">
                              Users ({aclGroups.allowedUsers.length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {aclGroups.allowedUsers.map((user, index) => (
                                <div
                                  key={`${user.ACLUniqueIdentifier}-${index}`}
                                  className="group relative"
                                >
                                  <span className="px-3 py-1 bg-blue-900/30 text-blue-400 rounded-full text-xs flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {user.ACLEntityGlobalname || user.ACLEntityName}
                                  </span>
                                  {user.ACLEntityGlobalname &&
                                    user.ACLEntityGlobalname !== user.ACLEntityName && (
                                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-gray-300 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                                        ID: {user.ACLEntityName}
                                      </div>
                                    )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {aclGroups.allowedGroups.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-400 mb-2">
                              Groups ({aclGroups.allowedGroups.length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {aclGroups.allowedGroups.map((group, index) => (
                                <span
                                  key={`${group.ACLUniqueIdentifier}-${index}`}
                                  className="px-3 py-1 bg-purple-900/30 text-purple-400 rounded-full text-xs flex items-center gap-1"
                                >
                                  <Users className="w-3 h-3" />
                                  {group.ACLEntityName}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Denied Access */}
                    {(aclGroups.deniedUsers.length > 0 || aclGroups.deniedGroups.length > 0) && (
                      <div className="border border-red-900/30 rounded-lg p-4 bg-red-900/10">
                        <div className="flex items-center gap-2 mb-3">
                          <ShieldOff className="w-4 h-4 text-red-400" />
                          <h4 className="text-sm font-medium text-red-400">Denied Access</h4>
                        </div>

                        {aclGroups.deniedUsers.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs text-gray-400 mb-2">
                              Users ({aclGroups.deniedUsers.length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {aclGroups.deniedUsers.map((user, index) => (
                                <span
                                  key={`${user.ACLUniqueIdentifier}-${index}`}
                                  className="px-3 py-1 bg-red-900/30 text-red-400 rounded-full text-xs flex items-center gap-1"
                                >
                                  <User className="w-3 h-3" />
                                  {user.ACLEntityGlobalname || user.ACLEntityName}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {aclGroups.deniedGroups.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-400 mb-2">
                              Groups ({aclGroups.deniedGroups.length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {aclGroups.deniedGroups.map((group, index) => (
                                <span
                                  key={`${group.ACLUniqueIdentifier}-${index}`}
                                  className="px-3 py-1 bg-red-900/30 text-red-400 rounded-full text-xs flex items-center gap-1"
                                >
                                  <Users className="w-3 h-3" />
                                  {group.ACLEntityName}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {doc.ErrorCode && (
                  <div className="mt-4 p-3 bg-red-900/20 border border-red-800/50 rounded">
                    <p className="text-sm text-red-400">
                      Error: {doc.ErrorMessage || doc.ErrorCode}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-gray-400">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default ACLViewerComponent;
