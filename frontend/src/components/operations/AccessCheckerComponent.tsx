// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { ResourceNotFoundException } from '@aws-sdk/client-qbusiness';
import {
  Search,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Users,
  User,
  Shield,
  Mail,
  RefreshCw,
} from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

import { cloudWatchProxyService } from '../../services/proxy/CloudWatchProxyService';
import { qBusinessProxyService } from '../../services/proxy/QBusinessProxyService';
import { Config, Document, AccessCheckResponse } from '../../types/types';

interface AccessCheckerComponentProps {
  config: Config;
}

const AccessCheckerComponent: React.FC<AccessCheckerComponentProps> = ({ config }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocs, setFilteredDocs] = useState<Document[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessResult, setAccessResult] = useState<AccessCheckResponse | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const serviceResult = await cloudWatchProxyService.fetchACLDocuments(config);

      if (serviceResult.success && serviceResult.data) {
        const data = serviceResult.data;
        setDocuments(data);
        setFilteredDocs(data);
      } else {
        throw new Error(serviceResult.error?.message || 'Failed to fetch ACL documents');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch documents');
      console.error('Error fetching documents:', err);
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
        doc.DocumentId?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    setFilteredDocs(filtered);
  }, [searchTerm, documents]);

  const checkAccess = async () => {
    if (!selectedDoc || !userEmail) return;

    try {
      setCheckingAccess(true);
      setError(null);
      setAccessResult(null);

      const serviceResult = await qBusinessProxyService.checkAccess(
        selectedDoc.DocumentId,
        userEmail,
        config,
      );

      if (serviceResult.success && serviceResult.data) {
        setAccessResult(serviceResult.data);
      } else {
        throw new Error(serviceResult.error?.message || 'Failed to check access');
      }
    } catch (err) {
      if (err instanceof ResourceNotFoundException) {
        setError('User does not exist!');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to check access');
      console.error('Error checking access:', err);
    } finally {
      setCheckingAccess(false);
    }
  };

  // Helper to remove duplicates
  const uniqueGroups = (
    groups: { name: string; type: string }[],
  ): { name: string; type: string }[] => {
    const seen = new Set<string>();
    return groups.filter((group) => {
      const key = `${group.name}-${group.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const uniqueUsers = (users: { id: string; type: string }[]): { id: string; type: string }[] => {
    const seen = new Set<string>();
    return users.filter((user) => {
      const key = `${user.id}-${user.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="w-12 h-12 text-purple-400 animate-spin mb-4" />
        <p className="text-gray-400">Loading documents...</p>
      </div>
    );
  }

  if (error && !documents.length) {
    return (
      <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <XCircle className="w-6 h-6 text-red-400" />
          <h3 className="text-lg font-semibold text-red-400">Error Loading Documents</h3>
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
      <h2 className="text-3xl font-bold mb-6">Access Checker</h2>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Document Selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-200">Select Document</h3>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:border-purple-500 focus:outline-none transition-all"
            />
          </div>

          {/* Document List */}
          <div className="max-h-96 overflow-y-auto space-y-2 custom-scrollbar">
            {filteredDocs.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No documents found</p>
            ) : (
              filteredDocs.map((doc) => (
                <button
                  key={doc.DocumentId}
                  onClick={() => setSelectedDoc(doc)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedDoc?.DocumentId === doc.DocumentId
                      ? 'bg-purple-900/30 border-purple-500'
                      : 'bg-gray-900/50 border-gray-800 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {doc.DocumentTitle || 'Untitled'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{doc.DocumentId}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Access Check Form */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-200">Check User Access</h3>

          {selectedDoc ? (
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Selected Document:</p>
              <p className="font-medium text-white">{selectedDoc.DocumentTitle}</p>
              <p className="text-xs text-gray-500">{selectedDoc.DocumentId}</p>
            </div>
          ) : (
            <div className="bg-gray-900/30 border border-gray-800 rounded-lg p-4 text-center">
              <p className="text-gray-500">Select a document to check access</p>
            </div>
          )}

          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              User Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                placeholder="user@example.com"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:border-purple-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Check Access Button */}
          <button
            onClick={checkAccess}
            disabled={!selectedDoc || !userEmail || checkingAccess}
            className={`w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              selectedDoc && userEmail && !checkingAccess
                ? 'bg-purple-500 hover:bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            {checkingAccess ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Checking Access...
              </>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                Check Access
              </>
            )}
          </button>
        </div>
      </div>

      {/* Access Results */}
      {accessResult && (
        <div className="mt-8 space-y-6">
          {/* Access Status */}
          <div
            className={`rounded-lg p-6 border ${
              accessResult.hasAccess
                ? 'bg-green-900/20 border-green-800/50'
                : 'bg-red-900/20 border-red-800/50'
            }`}
          >
            <div className="flex items-center gap-3">
              {accessResult.hasAccess ? (
                <CheckCircle className="w-8 h-8 text-green-400" />
              ) : (
                <XCircle className="w-8 h-8 text-red-400" />
              )}
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {accessResult.hasAccess ? 'Access Granted' : 'Access Denied'}
                </h3>
                <p className="text-gray-300">
                  {userEmail} {accessResult.hasAccess ? 'has' : 'does not have'} access to this
                  document
                </p>
              </div>
            </div>
          </div>

          {/* User Information */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* User Aliases */}
            {accessResult.userAliases && accessResult.userAliases.length > 0 && (
              <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-800">
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-400" />
                  User Identities
                </h4>
                <div className="space-y-2">
                  {uniqueUsers(accessResult.userAliases).map((alias, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                      <span className="text-gray-300">{alias.id}</span>
                      <span className="text-xs text-gray-500">({alias.type})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* User Groups */}
            {accessResult.userGroups && accessResult.userGroups.length > 0 && (
              <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-800">
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  User's Groups ({uniqueGroups(accessResult.userGroups).length})
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {uniqueGroups(accessResult.userGroups).map((group, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                      <span className="text-gray-300">{group.name}</span>
                      <span className="text-xs text-gray-500">({group.type})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Document ACL */}
          {accessResult.documentAcl && (
            <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-800">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-400" />
                Document Access Control List
              </h4>

              {accessResult.documentAcl.allowlist && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-400">
                    Access Conditions (Relation:{' '}
                    {accessResult.documentAcl.allowlist.memberRelation || 'OR'})
                  </p>

                  {accessResult.documentAcl.allowlist.conditions?.map((condition, condIndex) => (
                    <div
                      key={condIndex}
                      className="border border-gray-700 rounded-lg p-4 space-y-3"
                    >
                      <p className="text-xs text-gray-500">
                        Condition {condIndex + 1} (Relation: {condition.memberRelation || 'OR'})
                      </p>

                      {/* Allowed Users */}
                      {condition.users && condition.users.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-300 mb-2">Allowed Users:</p>
                          <div className="flex flex-wrap gap-2">
                            {condition.users.map((user, userIndex) => (
                              <span
                                key={userIndex}
                                className="px-3 py-1 bg-blue-900/30 text-blue-400 rounded-full text-xs"
                              >
                                {user.id}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Allowed Groups */}
                      {condition.groups && condition.groups.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-300 mb-2">Allowed Groups:</p>
                          <div className="flex flex-wrap gap-2">
                            {condition.groups.map((group, groupIndex) => (
                              <span
                                key={groupIndex}
                                className="px-3 py-1 bg-purple-900/30 text-purple-400 rounded-full text-xs"
                              >
                                {group.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 bg-red-900/20 border border-red-800/50 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
};

export default AccessCheckerComponent;
