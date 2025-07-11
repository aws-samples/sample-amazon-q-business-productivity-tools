// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Sync Metrics Component
 *
 * This is the consolidated version of the SyncMetricsComponent.
 * The duplicate version in /src/components/operations/SyncMetricsComponent.tsx
 * has been removed to avoid code duplication.
 */
import { DataSourceSyncJob } from '@aws-sdk/client-qbusiness';
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  TrendingUp,
  Zap,
  Calendar,
  Hash,
} from 'lucide-react';
import React, { useEffect, useState, useCallback } from 'react';

import { qBusinessProxyService } from '../services';

interface SyncJobMetricsProps {
  applicationId: string;
  indexId: string;
  dataSourceId: string;
  syncJobId: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  gradient: string;
  trend?: 'up' | 'down' | 'neutral';
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  gradient,
  trend,
}) => {
  return (
    <div className="relative group">
      <div
        className={`absolute -inset-0.5 ${gradient} rounded-2xl opacity-75 group-hover:opacity-100 blur transition duration-1000 group-hover:duration-200`}
      ></div>
      <div className="relative bg-gray-900/90 backdrop-blur-xl rounded-2xl p-6 border border-gray-800 hover:border-purple-500/50 transition-all duration-300">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-gray-400 text-sm font-medium">{title}</p>
            <p className="text-3xl font-bold text-white mt-2 tracking-tight">{value}</p>
            {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-xl ${gradient} bg-opacity-20`}>{icon}</div>
        </div>
        {trend && (
          <div className="mt-4 flex items-center">
            <TrendingUp
              className={`w-4 h-4 mr-1 ${
                trend === 'up'
                  ? 'text-green-400'
                  : trend === 'down'
                    ? 'text-red-400'
                    : 'text-gray-400'
              }`}
            />
            <span
              className={`text-sm ${
                trend === 'up'
                  ? 'text-green-400'
                  : trend === 'down'
                    ? 'text-red-400'
                    : 'text-gray-400'
              }`}
            >
              {trend === 'up' ? 'Increased' : trend === 'down' ? 'Decreased' : 'No change'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getStatusColor = () => {
    switch (status?.toUpperCase()) {
      case 'SUCCEEDED':
        return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'FAILED':
        return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'SYNCING':
      case 'SYNCING_INDEXING':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'INCOMPLETE':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor()}`}>
      {status}
    </span>
  );
};

export const SyncMetricsComponent: React.FC<SyncJobMetricsProps> = ({
  applicationId,
  indexId,
  dataSourceId,
  syncJobId,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncJob, setSyncJob] = useState<DataSourceSyncJob | null>(null);
  const [metrics, setMetrics] = useState<any>(null);

  const fetchSyncJobMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let result: any;

      if (applicationId) {
        const serviceResult = await qBusinessProxyService.getSyncJobMetrics(
          applicationId,
          indexId,
          dataSourceId,
          syncJobId,
        );

        if (serviceResult.success) {
          result = serviceResult.data;
        } else {
          throw new Error(serviceResult.error?.message || 'Failed to fetch sync job metrics');
        }
      }
      setSyncJob(result.syncJob);
      setMetrics(result.metrics);
    } catch (err) {
      console.error('Error fetching sync job metrics:', err);
      setError('Failed to load sync job metrics. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [applicationId, indexId, dataSourceId, syncJobId]);

  useEffect(() => {
    fetchSyncJobMetrics();
  }, [fetchSyncJobMetrics]);

  const formatDuration = (seconds: number | null): string => {
    if (seconds === null) return 'N/A';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatDate = (dateString: string | Date | undefined): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full blur animate-pulse"></div>
          <div className="relative bg-gray-900 rounded-full p-8">
            <Activity className="w-8 h-8 text-white animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !syncJob) {
    return (
      <div className="bg-red-900/20 backdrop-blur-lg border border-red-800 rounded-2xl p-8 text-center">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Error Loading Metrics</h3>
        <p className="text-gray-400">{error || 'Sync job not found'}</p>
        <button
          onClick={fetchSyncJobMetrics}
          className="mt-4 px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg text-white font-medium hover:from-purple-600 hover:to-blue-600 transition-all duration-200"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gray-900/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Sync Job Metrics</h2>
            <p className="text-gray-400 mt-1">Performance overview and statistics</p>
          </div>
          <StatusBadge status={syncJob.status || 'UNKNOWN'} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="flex items-center space-x-3">
            <Hash className="w-5 h-5 text-purple-400" />
            <div>
              <p className="text-gray-400 text-sm">Job ID</p>
              <p className="text-white font-mono text-sm">{syncJobId.slice(0, 8)}...</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Calendar className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-gray-400 text-sm">Start Time</p>
              <p className="text-white text-sm">{formatDate(syncJob.startTime)}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Clock className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-gray-400 text-sm">Duration</p>
              <p className="text-white text-sm">{formatDuration(metrics.duration)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Documents"
          value={metrics.totalDocuments.toLocaleString()}
          subtitle="Processed in this sync"
          icon={<FileText className="w-6 h-6 text-white" />}
          gradient="bg-gradient-to-br from-purple-500 to-purple-700"
        />

        <MetricCard
          title="Success Rate"
          value={`${metrics.successRate.toFixed(1)}%`}
          subtitle={`${metrics.successfulDocuments.toLocaleString()} successful`}
          icon={<CheckCircle className="w-6 h-6 text-white" />}
          gradient="bg-gradient-to-br from-green-500 to-green-700"
          trend={metrics.successRate >= 95 ? 'up' : metrics.successRate < 80 ? 'down' : 'neutral'}
        />

        <MetricCard
          title="Failed Documents"
          value={metrics.failedDocuments.toLocaleString()}
          subtitle={metrics.failedDocuments > 0 ? 'Review errors tab' : 'No failures'}
          icon={<XCircle className="w-6 h-6 text-white" />}
          gradient="bg-gradient-to-br from-red-500 to-red-700"
        />

        <MetricCard
          title="Processing Speed"
          value={metrics.documentsPerSecond ? `${metrics.documentsPerSecond.toFixed(1)}` : 'N/A'}
          subtitle="Documents per second"
          icon={<Zap className="w-6 h-6 text-white" />}
          gradient="bg-gradient-to-br from-yellow-500 to-orange-600"
        />
      </div>

      {/* Document Operations Breakdown */}
      <div className="bg-gray-900/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-800">
        <h3 className="text-xl font-bold text-white mb-6">Document Operations</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Documents Added</p>
                <p className="text-2xl font-bold text-green-400 mt-1">
                  {(syncJob.metrics?.documentsAdded || 0).toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Documents Modified</p>
                <p className="text-2xl font-bold text-blue-400 mt-1">
                  {(syncJob.metrics?.documentsModified || 0).toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Activity className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Documents Deleted</p>
                <p className="text-2xl font-bold text-purple-400 mt-1">
                  {(syncJob.metrics?.documentsDeleted || 0).toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <XCircle className="w-5 h-5 text-purple-400" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
