// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Utility functions for handling time-related operations
 */

/**
 * Calculate the duration between two dates
 */
export function calculateDuration(startTime: string | Date, endTime?: string | Date): string {
  if (!endTime) return 'In progress';

  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end.getTime() - start.getTime();

  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format a date for display
 */
export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Get relative time (e.g., "2 hours ago")
 */
export function getRelativeTime(date: string | Date): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}

/**
 * Convert time range to CloudWatch timestamp format
 */
export function toCloudWatchTimestamp(date: string | Date | undefined): number | undefined {
  if (!date) return undefined;
  return new Date(date).getTime();
}

/**
 * Check if a sync job is still running
 */
export function isSyncJobRunning(endTime?: string | Date): boolean {
  return !endTime;
}

/**
 * Format sync job time range for display
 */
export function formatSyncJobTimeRange(startTime?: string, endTime?: string): string {
  if (!startTime) return 'Unknown time range';

  const start = formatDateTime(startTime);

  if (!endTime) {
    return `Started: ${start} (Running)`;
  }

  const end = formatDateTime(endTime);
  const duration = calculateDuration(startTime, endTime);

  return `${start} - ${end} (${duration})`;
}
