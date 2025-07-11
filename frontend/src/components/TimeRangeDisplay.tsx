// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Clock, Calendar } from 'lucide-react';
import React from 'react';

import { Config } from '../types/types';
import { formatSyncJobTimeRange, calculateDuration, getRelativeTime } from '../utils/timeUtils';

interface TimeRangeDisplayProps {
  config: Config;
  compact?: boolean;
}

/**
 * Component to display sync job time range information
 * Can be used in dashboard components to show when the sync job ran
 */
const TimeRangeDisplay: React.FC<TimeRangeDisplayProps> = ({ config, compact = false }) => {
  if (!config.syncJobStartTime) {
    return null;
  }

  const timeRange = formatSyncJobTimeRange(config.syncJobStartTime, config.syncJobEndTime);
  const duration = config.syncJobEndTime
    ? calculateDuration(config.syncJobStartTime, config.syncJobEndTime)
    : 'In progress';
  const relativeTime = getRelativeTime(config.syncJobStartTime);

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Clock className="w-4 h-4" />
        <span>
          {duration} • {relativeTime}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 backdrop-blur-lg rounded-lg p-4 border border-gray-800">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-5 h-5 text-purple-400" />
        <h3 className="text-sm font-medium text-gray-300">Sync Job Time Range</h3>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Started:</span>
          <span className="text-gray-300">
            {new Date(config.syncJobStartTime).toLocaleString()}
          </span>
        </div>

        {config.syncJobEndTime && (
          <div className="flex justify-between">
            <span className="text-gray-500">Completed:</span>
            <span className="text-gray-300">
              {new Date(config.syncJobEndTime).toLocaleString()}
            </span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-gray-500">Duration:</span>
          <span className="text-gray-300">{duration}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-500">Run:</span>
          <span className="text-gray-400">{relativeTime}</span>
        </div>
      </div>

      {!config.syncJobEndTime && (
        <div className="mt-3 flex items-center gap-2 text-yellow-400 text-xs">
          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
          <span>Sync job is currently running</span>
        </div>
      )}
    </div>
  );
};

export default TimeRangeDisplay;

// Example usage in ACLViewer or other components:
/*
import TimeRangeDisplay from './TimeRangeDisplay';

// In your component
<TimeRangeDisplay config={config} />

// Or compact version
<TimeRangeDisplay config={config} compact />
*/
