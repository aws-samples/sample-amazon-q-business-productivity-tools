// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Users, User, Shield, GitBranch } from 'lucide-react';
import React from 'react';

import { GroupWithMembers } from '../../types/types';

interface GroupStatsProps {
  groups: GroupWithMembers[];
}

const GroupStats: React.FC<GroupStatsProps> = ({ groups }) => {
  // Calculate statistics
  const totalGroups = groups.length;
  const totalUniqueUsers = new Set(groups.flatMap((g) => g.members.users.map((u) => u.id))).size;
  const totalNestedGroups = groups.reduce((sum, g) => sum + g.members.groups.length, 0);
  const federatedGroups = groups.filter((g) => g.isGroupFederated).length;
  const groupsWithUsers = groups.filter((g) => g.members.users.length > 0).length;
  const groupsWithNestedGroups = groups.filter((g) => g.members.groups.length > 0).length;
  const emptyGroups = groups.filter((g) => g.totalMembers === 0).length;

  const largestGroup = groups.reduce(
    (max, g) => (g.totalMembers > (max?.totalMembers || 0) ? g : max),
    null as GroupWithMembers | null,
  );

  return (
    <div className="bg-gray-900/50 backdrop-blur-lg rounded-lg p-6 border border-gray-800 mb-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <GitBranch className="w-5 h-5 text-purple-400" />
        Group Membership Overview
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-3 bg-gray-800/50 rounded-lg">
          <Users className="w-6 h-6 text-purple-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{totalGroups}</p>
          <p className="text-xs text-gray-400">Total Groups</p>
        </div>

        <div className="text-center p-3 bg-gray-800/50 rounded-lg">
          <User className="w-6 h-6 text-blue-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{totalUniqueUsers}</p>
          <p className="text-xs text-gray-400">Unique Users</p>
        </div>

        <div className="text-center p-3 bg-gray-800/50 rounded-lg">
          <GitBranch className="w-6 h-6 text-green-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{totalNestedGroups}</p>
          <p className="text-xs text-gray-400">Nested Groups</p>
        </div>

        <div className="text-center p-3 bg-gray-800/50 rounded-lg">
          <Shield className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{federatedGroups}</p>
          <p className="text-xs text-gray-400">Federated</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="space-y-2">
          <div className="flex justify-between text-gray-400">
            <span>Groups with users:</span>
            <span className="text-white">{groupsWithUsers}</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Groups with nested groups:</span>
            <span className="text-white">{groupsWithNestedGroups}</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Empty groups:</span>
            <span className="text-white">{emptyGroups}</span>
          </div>
        </div>

        {largestGroup && (
          <div className="bg-gray-800/30 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Largest Group</p>
            <p className="text-sm font-medium text-white truncate">{largestGroup.displayName}</p>
            <p className="text-xs text-gray-500">{largestGroup.totalMembers} members</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupStats;
