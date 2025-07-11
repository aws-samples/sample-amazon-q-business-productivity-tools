// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import {
  Search,
  AlertTriangle,
  FileX,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Copy,
  CheckCircle,
} from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

import { cloudWatchProxyService } from '../../services/proxy/CloudWatchProxyService';
import { Config, SyncError } from '../../types/types';
import { getRelativeTime } from '../../utils/timeUtils';

interface SyncErrorsComponentProps {
  config: Config;
}

interface ErrorGroup {
  errorCode: string;
  errorMessage: string;
  documents: Array<{
    id: string;
    title?: string;
    sourceUri?: string;
  }>;
  count: number;
}

const SyncErrorsComponent: React.FC<SyncErrorsComponentProps> = ({ config }) => {
  const [errors, setErrors] = useState<SyncError[]>([]);
  const [filteredErrors, setFilteredErrors] = useState<SyncError[]>([]);
  const [errorGroups, setErrorGroups] = useState<ErrorGroup[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('grouped');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const itemsPerPage = 20;

  const fetchSyncErrors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log(`Fetching sync errors for job: ${config.syncJobExecutionId}`);
      const result = await cloudWatchProxyService.fetchSyncErrors(config);
      const data = result.success && result.data ? result.data : [];
      setErrors(data);
      setFilteredErrors(data);
      groupErrors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sync errors');
      console.error('Error fetching sync errors:', err);
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    fetchSyncErrors();
  }, [fetchSyncErrors]);

  const groupErrors = (errorList: SyncError[]) => {
    const groups = new Map<string, ErrorGroup>();

    errorList.forEach((error) => {
      const key = `${error.ErrorCode}:${error.ErrorMessage}`;

      if (!groups.has(key)) {
        groups.set(key, {
          errorCode: error.ErrorCode,
          errorMessage: error.ErrorMessage,
          documents: [],
          count: 0,
        });
      }

      const group = groups.get(key)!;
      group.documents.push({
        id: error.DocumentId,
        title: error.DocumentTitle,
        sourceUri: error.SourceURI,
      });
      group.count++;
    });
    // Sort groups by count (most common errors first)
    const sortedGroups = Array.from(groups.values()).sort((a, b) => b.count - a.count);
    setErrorGroups(sortedGroups);
  };

  useEffect(() => {
    const filtered = errors.filter((error) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        error.DocumentId.toLowerCase().includes(searchLower) ||
        error.ErrorCode.toLowerCase().includes(searchLower) ||
        error.ErrorMessage.toLowerCase().includes(searchLower) ||
        (error.DocumentTitle && error.DocumentTitle.toLowerCase().includes(searchLower))
      );
    });
    setFilteredErrors(filtered);
    groupErrors(filtered);
    setCurrentPage(1);
  }, [searchTerm, errors]);

  const toggleGroup = (errorCode: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(errorCode)) {
      newExpanded.delete(errorCode);
    } else {
      newExpanded.add(errorCode);
    }
    setExpandedGroups(newExpanded);
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Pagination for list view
  const totalPages = Math.ceil(filteredErrors.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayedErrors = filteredErrors.slice(startIndex, startIndex + itemsPerPage);

  // Error statistics
  const uniqueErrorCodes = new Set(errors.map((e) => e.ErrorCode)).size;
  const mostCommonError = errorGroups[0];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="w-12 h-12 text-purple-400 animate-spin mb-4" />
        <p className="text-gray-400">Loading sync errors...</p>
        {config.syncJobStartTime && (
          <p className="text-sm text-gray-500 mt-2">
            Analyzing errors from {getRelativeTime(config.syncJobStartTime)}
          </p>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-red-400" />
          <h3 className="text-lg font-semibold text-red-400">Error Loading Sync Errors</h3>
        </div>
        <p className="text-gray-300 mb-4">{error}</p>
        <button
          onClick={fetchSyncErrors}
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
      <div className="mb-6">
        <h2 className="text-3xl font-bold mb-2">Sync Errors</h2>
        <p className="text-gray-400">Document errors encountered during the sync job</p>
      </div>

      {/* Error Statistics */}
      {errors.length > 0 && (
        <div className="bg-gray-900/50 backdrop-blur-lg rounded-lg p-6 border border-gray-800 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Error Summary
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-800/50 rounded-lg">
              <FileX className="w-6 h-6 text-red-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{errors.length}</p>
              <p className="text-xs text-gray-400">Total Errors</p>
            </div>

            <div className="text-center p-3 bg-gray-800/50 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{uniqueErrorCodes}</p>
              <p className="text-xs text-gray-400">Error Types</p>
            </div>

            <div className="text-center p-3 bg-gray-800/50 rounded-lg">
              <FileX className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">
                {new Set(errors.map((e) => e.DocumentId)).size}
              </p>
              <p className="text-xs text-gray-400">Affected Documents</p>
            </div>

            {mostCommonError && (
              <div className="text-center p-3 bg-gray-800/50 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Most Common</p>
                <p className="text-sm font-medium text-white truncate">
                  {mostCommonError.errorCode}
                </p>
                <p className="text-xs text-gray-500">{mostCommonError.count} occurrences</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search and View Toggle */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by document ID, error code, or message..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:border-purple-500 focus:outline-none transition-all"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grouped')}
              className={`px-4 py-3 rounded-lg transition-all text-sm ${
                viewMode === 'grouped'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
              }`}
            >
              Grouped
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-3 rounded-lg transition-all text-sm ${
                viewMode === 'list'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
              }`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {filteredErrors.length === 0 ? (
        <div className="text-center py-12 bg-gray-900/50 backdrop-blur-lg rounded-lg border border-gray-800">
          <FileX className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">
            {searchTerm ? 'No errors match your search' : 'No errors found in this sync job'}
          </p>
        </div>
      ) : (
        <>
          {viewMode === 'grouped' ? (
            // Grouped View
            <div className="space-y-4">
              {errorGroups.map((group) => {
                const isExpanded = expandedGroups.has(group.errorCode);

                return (
                  <div
                    key={`${group.errorCode}:${group.errorMessage}`}
                    className="bg-gray-900/50 backdrop-blur-lg rounded-lg border border-gray-800 hover:border-red-500/50 transition-all"
                  >
                    <button
                      onClick={() => toggleGroup(group.errorCode)}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-800/30 transition-all"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="text-gray-400">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </div>
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-white">{group.errorCode}</h3>
                          <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                            {group.errorMessage}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="px-3 py-1 bg-red-900/30 text-red-400 rounded-full text-sm">
                          {group.count} error{group.count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4">
                        <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
                          <p className="text-sm text-gray-300 font-mono break-all">
                            {group.errorMessage}
                          </p>
                        </div>

                        <h4 className="text-sm font-medium text-gray-300 mb-3">
                          Affected Documents ({group.documents.length})
                        </h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                          {group.documents.map((doc, index) => (
                            <div
                              key={`${doc.id}-${index}`}
                              className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg group"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white truncate">
                                  {doc.sourceUri ? (
                                    <a
                                      href={doc.sourceUri}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 underline hover:text-blue-800 cursor-pointer"
                                    >
                                      {doc.sourceUri.split('/').pop() || doc.id}
                                    </a>
                                  ) : (
                                    <span>{doc.id}</span>
                                  )}

                                  {/*<a href={doc.sourceUri} target="_blank" rel="noopener noreferrer"*/}
                                  {/*   className="text-blue-600 underline hover:text-blue-800 cursor-pointer">{doc.sourceUri!.split('/').pop() || doc.id}</a>*/}
                                </p>
                                {doc.title && (
                                  <p className="text-xs text-gray-500 truncate">ID: {doc.id}</p>
                                )}
                              </div>
                              <button
                                onClick={() => copyToClipboard(doc.id, doc.id)}
                                className="ml-2 p-1 text-gray-400 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                title="Copy Document ID"
                              >
                                {copiedId === doc.id ? (
                                  <CheckCircle className="w-4 h-4 text-green-400" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            // List View
            <div className="space-y-4">
              {displayedErrors.map((error, index) => (
                <div
                  key={`${error.DocumentId}-${index}`}
                  className="bg-gray-900/50 backdrop-blur-lg rounded-lg p-4 border border-gray-800 hover:border-red-500/50 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-white">
                          {error.SourceURI ? (
                            <a
                              href={error.SourceURI}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 underline hover:text-blue-800 cursor-pointer"
                            >
                              {error.SourceURI.split('/').pop() || error.DocumentId}
                            </a>
                          ) : (
                            <span>{error.DocumentId}</span>
                          )}

                          {/*<a href={error.SourceURI} target="_blank" rel="noopener noreferrer"*/}
                          {/*   className="text-blue-600 underline hover:text-blue-800 cursor-pointer">{error.SourceURI!.split('/').pop() || error.DocumentId}</a>*/}
                        </h3>

                        <span className="px-2 py-1 bg-red-900/30 text-green-400 rounded text-xs">
                          DocId: {error.DocumentId}
                        </span>
                        <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded text-xs">
                          ErrorCode: {error.ErrorCode}
                        </span>
                      </div>

                      {error.DocumentTitle && (
                        <p className="text-xs text-gray-500 mb-2">ID: {error.DocumentId}</p>
                      )}

                      <p className="text-sm text-gray-300">{error.ErrorMessage}</p>

                      {error.timestamp && (
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(error.timestamp).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination for List View */}
          {viewMode === 'list' && totalPages > 1 && (
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
        </>
      )}

      {/* Summary */}
      {filteredErrors.length > 0 && (
        <div className="mt-6 text-center text-sm text-gray-500">
          {viewMode === 'grouped'
            ? `Showing ${errorGroups.length} error group${errorGroups.length !== 1 ? 's' : ''} from ${filteredErrors.length} total error${filteredErrors.length !== 1 ? 's' : ''}`
            : `Showing ${Math.min(itemsPerPage, filteredErrors.length - startIndex)} of ${filteredErrors.length} error${filteredErrors.length !== 1 ? 's' : ''}`}
        </div>
      )}
    </div>
  );
};

export default SyncErrorsComponent;
