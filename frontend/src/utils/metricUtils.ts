// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// utils/metricsUtils.ts

/**
 * Format large numbers with appropriate suffixes (K, M, B)
 */
export const formatLargeNumber = (num: number): string => {
  if (num >= 1e9) {
    return `${(num / 1e9).toFixed(1)}B`;
  } else if (num >= 1e6) {
    return `${(num / 1e6).toFixed(1)}M`;
  } else if (num >= 1e3) {
    return `${(num / 1e3).toFixed(1)}K`;
  }
  return num.toLocaleString();
};

/**
 * Calculate percentage change between two values
 */
export const calculatePercentageChange = (
  oldValue: number,
  newValue: number,
): { value: number; trend: 'up' | 'down' | 'neutral' } => {
  if (oldValue === 0) {
    return { value: 0, trend: 'neutral' };
  }

  const change = ((newValue - oldValue) / oldValue) * 100;

  return {
    value: Math.abs(change),
    trend: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
  };
};

/**
 * Get color classes based on success rate
 */
export const getSuccessRateColor = (rate: number): string => {
  if (rate >= 95) return 'text-green-400';
  if (rate >= 80) return 'text-blue-400';
  if (rate >= 60) return 'text-yellow-400';
  return 'text-red-400';
};

/**
 * Format bytes to human readable format
 */
export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Calculate estimated time remaining based on current progress
 */
export const calculateETA = (processed: number, total: number, elapsedSeconds: number): string => {
  if (processed === 0 || total === 0) return 'N/A';

  const rate = processed / elapsedSeconds;
  const remaining = total - processed;
  const secondsRemaining = remaining / rate;

  if (secondsRemaining < 60) {
    return `${Math.round(secondsRemaining)}s`;
  } else if (secondsRemaining < 3600) {
    return `${Math.round(secondsRemaining / 60)}m`;
  } else {
    const hours = Math.floor(secondsRemaining / 3600);
    const minutes = Math.round((secondsRemaining % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
};

/**
 * Get status color configuration
 */
export const getStatusConfig = (
  status: string,
): {
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: string;
} => {
  const statusUpper = status?.toUpperCase();

  switch (statusUpper) {
    case 'SUCCEEDED':
      return {
        bgColor: 'bg-green-500/20',
        textColor: 'text-green-400',
        borderColor: 'border-green-500/50',
        icon: 'CheckCircle',
      };
    case 'FAILED':
      return {
        bgColor: 'bg-red-500/20',
        textColor: 'text-red-400',
        borderColor: 'border-red-500/50',
        icon: 'XCircle',
      };
    case 'SYNCING':
    case 'SYNCING_INDEXING':
      return {
        bgColor: 'bg-blue-500/20',
        textColor: 'text-blue-400',
        borderColor: 'border-blue-500/50',
        icon: 'Activity',
      };
    case 'INCOMPLETE':
      return {
        bgColor: 'bg-yellow-500/20',
        textColor: 'text-yellow-400',
        borderColor: 'border-yellow-500/50',
        icon: 'AlertCircle',
      };
    default:
      return {
        bgColor: 'bg-gray-500/20',
        textColor: 'text-gray-400',
        borderColor: 'border-gray-500/50',
        icon: 'Info',
      };
  }
};
