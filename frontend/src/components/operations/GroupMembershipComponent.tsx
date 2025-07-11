// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import {
  Search,
  Users,
  User,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  Shield,
} from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

import GroupStats from './GroupStats';
import { cloudWatchProxyService } from '../../services/proxy/CloudWatchProxyService';
import { Config, GroupWithMembers } from '../../types/types';
import { getRelativeTime } from '../../utils/timeUtils';

interface GroupMembershipComponentProps {
  config: Config;
}

const GroupMembershipComponent: React.FC<GroupMembershipComponentProps> = ({ config }) => {
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<GroupWithMembers[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const fetchGroupMembership = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await cloudWatchProxyService.fetchGroupMembership(config);

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch group membership');
      }

      const data = result.data || [];
      setGroups(data);
      setFilteredGroups(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch group membership');
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    fetchGroupMembership();
  }, [fetchGroupMembership]);

  useEffect(() => {
    const filtered = groups.filter((group) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        group.displayName.toLowerCase().includes(searchLower) ||
        group.groupName.toLowerCase().includes(searchLower) ||
        group.members.users.some(
          (user) =>
            user.id.toLowerCase().includes(searchLower) ||
            user.email?.toLowerCase().includes(searchLower),
        ) ||
        group.members.groups.some((g) => g.displayName.toLowerCase().includes(searchLower))
      );
    });
    setFilteredGroups(filtered);
  }, [searchTerm, groups]);

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  const expandAll = () => {
    setExpandedGroups(new Set(filteredGroups.map((g) => g.groupName)));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="w-12 h-12 text-purple-400 animate-spin mb-4" />
        <p className="text-gray-400">Loading group membership data...</p>
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
          <h3 className="text-lg font-semibold text-red-400">Error Loading Group Membership</h3>
        </div>
        <p className="text-gray-300 mb-4">{error}</p>
        <button
          onClick={fetchGroupMembership}
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
        <h2 className="text-3xl font-bold mb-2">Group Membership</h2>
        <p className="text-gray-400">Explore groups and their members from the sync job</p>
      </div>

      {/* Group Statistics */}
      {groups.length > 0 && <GroupStats groups={groups} />}

      {/* Search and Controls */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search groups, users, or emails..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:border-purple-500 focus:outline-none transition-all"
            />
          </div>
          <button
            onClick={expandAll}
            className="px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-all text-sm"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-all text-sm"
          >
            Collapse All
          </button>
        </div>

        {groups.filter((g) => g.isGroupFederated).length > 0 && (
          <div className="flex items-center gap-2 text-sm text-blue-300 bg-blue-900/20 border border-blue-800/50 rounded-lg px-4 py-2">
            <Shield className="w-4 h-4" />
            <span>
              {groups.filter((g) => g.isGroupFederated).length} federated group
              {groups.filter((g) => g.isGroupFederated).length !== 1 ? 's' : ''} found
            </span>
          </div>
        )}
      </div>

      {/* Groups List */}
      <div className="space-y-4">
        {filteredGroups.length === 0 ? (
          <div className="text-center py-12 bg-gray-900/50 backdrop-blur-lg rounded-lg border border-gray-800">
            <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">
              {searchTerm ? 'No groups match your search' : 'No group membership data found'}
            </p>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.groupName);

            return (
              <div
                key={group.groupName}
                className="bg-gray-900/50 backdrop-blur-lg rounded-lg border border-gray-800 hover:border-purple-500/50 transition-all"
              >
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(group.groupName)}
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
                    <Users className="w-5 h-5 text-purple-400" />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        {group.displayName}
                        {group.isGroupFederated && (
                          <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded text-xs">
                            Federated
                          </span>
                        )}
                      </h3>
                      {group.displayName !== group.groupName && (
                        <p className="text-xs text-gray-500 mt-1">Full name: {group.groupName}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-400">
                      {group.totalMembers} member{group.totalMembers !== 1 ? 's' : ''}
                    </div>
                  </div>
                </button>

                {/* Group Members */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4">
                    {/* Users */}
                    {group.members.users.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                          <User className="w-4 h-4 text-blue-400" />
                          Users ({group.members.users.length})
                        </h4>
                        <div className="grid gap-2">
                          {group.members.users.map((user, index) => (
                            <div
                              key={`${user.id}-${index}`}
                              className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg"
                            >
                              <User className="w-4 h-4 text-blue-400" />
                              <div className="flex-1">
                                <p className="text-sm text-white">{user.email || user.id}</p>
                                {user.email && user.email !== user.id && (
                                  <p className="text-xs text-gray-500">ID: {user.id}</p>
                                )}
                              </div>
                              {user.isFederated && (
                                <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded text-xs">
                                  Federated
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Nested Groups */}
                    {group.members.groups.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                          <Users className="w-4 h-4 text-green-400" />
                          Nested Groups ({group.members.groups.length})
                        </h4>
                        <div className="grid gap-2">
                          {group.members.groups.map((nestedGroup, index) => (
                            <div
                              key={`${nestedGroup.name}-${index}`}
                              className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg"
                            >
                              <Users className="w-4 h-4 text-green-400" />
                              <div className="flex-1">
                                <p className="text-sm text-white">{nestedGroup.displayName}</p>
                                {nestedGroup.displayName !== nestedGroup.name && (
                                  <p className="text-xs text-gray-500">Full: {nestedGroup.name}</p>
                                )}
                              </div>
                              {nestedGroup.isFederated && (
                                <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded text-xs">
                                  Federated
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Empty State */}
                    {group.members.users.length === 0 && group.members.groups.length === 0 && (
                      <p className="text-center text-gray-500 py-4">
                        No members found in this group
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Summary */}
      {filteredGroups.length > 0 && (
        <div className="mt-6 text-center text-sm text-gray-500">
          Showing {filteredGroups.length} of {groups.length} groups
        </div>
      )}
    </div>
  );
};

export default GroupMembershipComponent;
