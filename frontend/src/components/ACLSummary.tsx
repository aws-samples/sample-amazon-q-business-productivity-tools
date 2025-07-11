// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Users, User } from 'lucide-react';
import React from 'react';

import { ACLEntity } from '../types/types';

interface ACLSummaryProps {
  acl: ACLEntity[];
}

const ACLSummary: React.FC<ACLSummaryProps> = ({ acl }) => {
  // Calculate totals
  const totalUsers = acl.filter((e) => e.ACLEntityType === 'USER').length;
  const totalGroups = acl.filter((e) => e.ACLEntityType === 'GROUP').length;
  const allowedCount = acl.filter((e) => e.ACLEntityAccess === 'ALLOW').length;
  const deniedCount = acl.filter((e) => e.ACLEntityAccess === 'DENY').length;

  return (
    <div className="flex flex-wrap gap-3 text-xs">
      <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-800/50 rounded">
        <User className="w-3 h-3 text-blue-400" />
        <span className="text-gray-300">
          {totalUsers} User{totalUsers !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-800/50 rounded">
        <Users className="w-3 h-3 text-purple-400" />
        <span className="text-gray-300">
          {totalGroups} Group{totalGroups !== 1 ? 's' : ''}
        </span>
      </div>

      {allowedCount > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-green-900/20 rounded">
          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
          <span className="text-green-400">{allowedCount} Allowed</span>
        </div>
      )}

      {deniedCount > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-red-900/20 rounded">
          <div className="w-2 h-2 bg-red-400 rounded-full"></div>
          <span className="text-red-400">{deniedCount} Denied</span>
        </div>
      )}
    </div>
  );
};

export default ACLSummary;
