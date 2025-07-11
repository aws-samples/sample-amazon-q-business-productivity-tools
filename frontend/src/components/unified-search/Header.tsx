// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { ChevronDown } from 'lucide-react';
import React from 'react';

import { Application } from '../../services/proxy/QBusinessProxyService';
import { Config, QBusinessConfig } from '../../types/types';

interface HeaderProps {
  availableApplications: Application[];
  config: Config | null;
  isAiResponseLoading: boolean;
  isDocumentsLoading: boolean;
  isLoadingApplications: boolean;
  handleApplicationChange: (applicationId: string) => void;
}

const Header: React.FC<HeaderProps> = ({
  availableApplications,
  config,
  isAiResponseLoading,
  isDocumentsLoading,
  isLoadingApplications,
  handleApplicationChange,
}) => {
  return (
    <header className="border-b border-gray-800 backdrop-blur-lg bg-gray-900/50 sticky top-0 z-50">
      <div className="w-full px-4 py-4 flex justify-between items-center">
        {/* Left section with padding for "Back to Tools" button */}
        <div className="flex items-center">
          {/* Space for the "Back to Tools" button */}
          <div className="w-36"></div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent ml-4">
            Unified Search
          </h1>
        </div>

        {/* Application Selector */}
        {availableApplications.length > 0 && (
          <div className="relative mr-28">
            {' '}
            {/* Add margin to the right to make space for Sign Out button */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Application:</span>
              <div className="relative">
                <select
                  value={config ? (config as QBusinessConfig).applicationId : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleApplicationChange(e.target.value);
                    }
                  }}
                  className="appearance-none bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={isAiResponseLoading || isDocumentsLoading || isLoadingApplications}
                >
                  <option value="">Select Application</option>
                  {isLoadingApplications ? (
                    <option disabled>Loading applications...</option>
                  ) : (
                    availableApplications.map((app) => (
                      <option key={app.applicationId} value={app.applicationId}>
                        {app.displayName || app.applicationId}
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
