// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Settings, ChevronDown, Database, Loader2 } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import AccessCheckerComponent from './AccessCheckerComponent';
import ACLViewerComponent from './ACLViewerComponent';
// import GroupMembershipComponent from './GroupMembershipComponent';
import SyncErrorsComponent from './SyncErrorsComponent';
import {
  qBusinessProxyService,
  Application,
  Index,
  DataSource,
  SyncJob,
} from '../../services/proxy/QBusinessProxyService';
import { DashboardProps, Config, QBusinessConfig } from '../../types/types';
import { SyncMetricsComponent } from '../SyncMetricsComponent';

const Dashboard: React.FC<DashboardProps> = ({ config, onConfigChange }) => {
  const [activeTab, setActiveTab] = useState('metrics');
  const [configurationType] = useState<'QBUSINESS' | 'KENDRA'>(config.type);
  const isQBusinessConfig = configurationType === 'QBUSINESS';

  // State for QBusiness and Kendra resources
  const [qbApplications, setQbApplications] = useState<Application[]>([]);
  const [qbIndices, setQbIndices] = useState<Index[]>([]);
  const [qbDataSources, setQbDataSources] = useState<DataSource[]>([]);
  const [qbSyncJobs, setQbSyncJobs] = useState<SyncJob[]>([]);
  // Selected values
  const [selectedQbApplication, setSelectedQbApplication] = useState<string>(
    isQBusinessConfig ? (config as QBusinessConfig).applicationId : '',
  );
  const [selectedQbIndex, setSelectedQbIndex] = useState<string>(
    isQBusinessConfig ? (config as QBusinessConfig).indexId : '',
  );
  const [selectedQbDataSource, setSelectedQbDataSource] = useState<string>(
    isQBusinessConfig ? (config as QBusinessConfig).dataSourceId : '',
  );
  const [selectedQbSyncJob, setSelectedQbSyncJob] = useState<string>(
    isQBusinessConfig ? (config as QBusinessConfig).syncJobExecutionId : '',
  );

  // Loading states
  const [loadingQbApplications, setLoadingQbApplications] = useState<boolean>(false);
  const [loadingQbIndices, setLoadingQbIndices] = useState<boolean>(false);
  const [loadingQbDataSources, setLoadingQbDataSources] = useState<boolean>(false);
  const [loadingQbSyncJobs, setLoadingQbSyncJobs] = useState<boolean>(false);

  // Error and message states
  const [error, setError] = useState<string | null>(null);
  const [tempMessage, setTempMessage] = useState<string | null>(null);

  // Reset active tab when config changes or when switching between Q Business and Kendra
  useEffect(() => {
    if (!isQBusinessConfig && (activeTab === 'groups' || activeTab === 'access')) {
      setActiveTab('metrics');
    }
  }, [isQBusinessConfig, activeTab, config]); // Added config as dependency

  // Check if configuration is complete
  const isConfigurationComplete = () => {
    if (configurationType === 'QBUSINESS') {
      return (
        !!selectedQbApplication &&
        !!selectedQbIndex &&
        !!selectedQbDataSource &&
        !!selectedQbSyncJob
      );
    }
  };

  // Define available tabs based on current config
  const getTabs = () => [
    { id: 'metrics', label: 'Sync Metrics', show: true },
    // { id: 'groups', label: 'Group Membership', show: isQBusinessConfig },
    { id: 'acl', label: 'ACL Viewer', show: true },
    { id: 'access', label: 'Access Checker', show: isQBusinessConfig },
    { id: 'errors', label: 'Sync Errors', show: true },
  ];

  // Load QBusiness applications
  useEffect(() => {
    const fetchQbApplications = async () => {
      try {
        setLoadingQbApplications(true);
        setError(null);

        const result = await qBusinessProxyService.listApplications();
        if (result.success && result.data) {
          setQbApplications(result.data);
        } else {
          throw new Error(result.error?.message || 'Failed to load applications');
        }
      } catch (error) {
        console.error('Error loading QBusiness applications:', error);
        setError('Failed to load QBusiness applications');
      } finally {
        setLoadingQbApplications(false);
      }
    };

    if (configurationType === 'QBUSINESS') {
      fetchQbApplications();
    }
  }, [configurationType]);

  // Load QBusiness indices when an application is selected
  useEffect(() => {
    const fetchQbIndices = async () => {
      if (!selectedQbApplication) return;

      try {
        setLoadingQbIndices(true);
        setError(null);

        const result = await qBusinessProxyService.listIndices(selectedQbApplication);
        if (result.success && result.data) {
          setQbIndices(result.data);
        } else {
          throw new Error(result.error?.message || 'Failed to load indices');
        }
      } catch (error) {
        console.error('Error loading QBusiness indices:', error);
        setError('Failed to load QBusiness indices');
      } finally {
        setLoadingQbIndices(false);
      }
    };

    if (selectedQbApplication) {
      fetchQbIndices();
    }
  }, [selectedQbApplication]);

  // Load QBusiness data sources when an index is selected
  useEffect(() => {
    const fetchQbDataSources = async () => {
      if (!selectedQbApplication || !selectedQbIndex) return;

      try {
        setLoadingQbDataSources(true);
        setError(null);

        const result = await qBusinessProxyService.listDataSources(
          selectedQbApplication,
          selectedQbIndex,
        );
        if (result.success && result.data) {
          setQbDataSources(result.data);
        } else {
          throw new Error(result.error?.message || 'Failed to load data sources');
        }
      } catch (error) {
        console.error('Error loading QBusiness data sources:', error);
        setError('Failed to load QBusiness data sources');
      } finally {
        setLoadingQbDataSources(false);
      }
    };

    if (selectedQbApplication && selectedQbIndex) {
      fetchQbDataSources();
    }
  }, [selectedQbApplication, selectedQbIndex]);

  // Load QBusiness sync jobs when a data source is selected
  useEffect(() => {
    const fetchQbSyncJobs = async () => {
      if (!selectedQbApplication || !selectedQbIndex || !selectedQbDataSource) return;

      try {
        setLoadingQbSyncJobs(true);
        setError(null);

        const result = await qBusinessProxyService.listDataSourceSyncJobs(
          selectedQbApplication,
          selectedQbIndex,
          selectedQbDataSource,
        );

        if (result.success && result.data) {
          setQbSyncJobs(result.data);
        } else {
          throw new Error(result.error?.message || 'Failed to load sync jobs');
        }
      } catch (error) {
        console.error('Error loading QBusiness sync jobs:', error);
        setError('Failed to load QBusiness sync jobs');
      } finally {
        setLoadingQbSyncJobs(false);
      }
    };

    if (selectedQbApplication && selectedQbIndex && selectedQbDataSource) {
      fetchQbSyncJobs();
    }
  }, [selectedQbApplication, selectedQbIndex, selectedQbDataSource]);

  // Clear temporary message after a delay
  useEffect(() => {
    if (tempMessage) {
      const timer = setTimeout(() => {
        setTempMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [tempMessage]);

  // Update configuration when selections change
  const updateConfiguration = () => {
    let newConfig: Config;

    if (configurationType === 'QBUSINESS') {
      if (
        !selectedQbApplication ||
        !selectedQbIndex ||
        !selectedQbDataSource ||
        !selectedQbSyncJob
      ) {
        setTempMessage(
          'Please complete the configuration by selecting an application, index, data source, and sync job',
        );
        return;
      }

      // Find the selected application to get its retrieverId
      const selectedApp = qbApplications.find((app) => app.applicationId === selectedQbApplication);
      const retrieverId = selectedApp ? selectedApp.retrieverId : '';

      // Find the selected sync job to get its startTime and endTime
      const selectedJob = selectedQbSyncJob
        ? qbSyncJobs.find((job) => job.executionId === selectedQbSyncJob)
        : undefined;

      newConfig = {
        type: 'QBUSINESS',
        applicationId: selectedQbApplication,
        indexId: selectedQbIndex,
        dataSourceId: selectedQbDataSource,
        syncJobExecutionId: selectedQbSyncJob || '',
        retrieverId: retrieverId,
        syncJobStartTime: selectedJob?.startTime,
        syncJobEndTime: selectedJob?.endTime,
      } as QBusinessConfig;

      localStorage.setItem('application-configuration', JSON.stringify(newConfig));
    }
    // Save the configuration to local storage

    // Update the local config state to refresh the current screen
    // instead of triggering the parent component's onConfigChange
    // which would take the user to the Configure Dashboard modal
    setError(null);

    // Show success message
    const successMessage = document.createElement('div');
    successMessage.className =
      'fixed top-4 right-4 bg-green-900/80 text-green-100 px-4 py-2 rounded-lg shadow-lg z-50';
    successMessage.textContent = 'Configuration updated successfully!';
    document.body.appendChild(successMessage);

    // Remove success message after 3 seconds
    setTimeout(() => {
      document.body.removeChild(successMessage);
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 backdrop-blur-lg bg-gray-900/50 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            {isQBusinessConfig
              ? 'Q Business Sync Operations Dashboard'
              : 'Kendra Sync Operations Dashboard'}
          </h1>
        </div>
      </header>

      {/* Configuration Selector */}
      <div className="border-b border-gray-800 bg-gray-900/30">
        <div className="container mx-auto px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Service Type Selector - Disabled Kendra option */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Service Type!</label>
              <div className="relative">
                <select
                  value="QBUSINESS"
                  disabled={true}
                  className="appearance-none w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent cursor-not-allowed opacity-70"
                >
                  <option value="QBUSINESS">QBusiness</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Application Selector (QBusiness only) */}
            {configurationType === 'QBUSINESS' && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Application</label>
                <div className="relative">
                  <select
                    value={selectedQbApplication}
                    onChange={(e) => {
                      const newAppId = e.target.value;
                      setSelectedQbApplication(newAppId);
                      // Reset dependent fields when application changes
                      setSelectedQbIndex('');
                      setSelectedQbDataSource('');
                      setSelectedQbSyncJob('');
                      // Clear data arrays
                      setQbIndices([]);
                      setQbDataSources([]);
                      setQbSyncJobs([]);
                    }}
                    className="appearance-none w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={loadingQbApplications}
                  >
                    <option value="">Select Application</option>
                    {qbApplications.map((app) => (
                      <option key={app.applicationId} value={app.applicationId}>
                        {app.displayName || app.applicationId}
                      </option>
                    ))}
                  </select>
                  {loadingQbApplications ? (
                    <Loader2 className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
                  ) : (
                    <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  )}
                </div>
              </div>
            )}

            {/* Index Selector */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Index</label>
              <div className="relative">
                <select
                  value={configurationType === 'QBUSINESS' ? selectedQbIndex : ''}
                  onChange={(e) => {
                    const newIndexId = e.target.value;
                    if (configurationType === 'QBUSINESS') {
                      setSelectedQbIndex(newIndexId);
                      // Reset dependent fields when index changes
                      setSelectedQbDataSource('');
                      setSelectedQbSyncJob('');
                      // Clear data arrays
                      setQbDataSources([]);
                      setQbSyncJobs([]);
                    }
                  }}
                  className="appearance-none w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={
                    configurationType === 'QBUSINESS' &&
                    (!selectedQbApplication || loadingQbIndices)
                  }
                >
                  <option value="">Select Index</option>
                  {qbIndices.map((index) => (
                    <option key={index.indexId} value={index.indexId}>
                      {index.indexId}
                    </option>
                  ))}
                </select>
                {(configurationType === 'QBUSINESS' && loadingQbIndices) ||
                configurationType === 'KENDRA' ? (
                  <Loader2 className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
                ) : (
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                )}
              </div>
            </div>

            {/* Data Source Selector */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Data Source</label>
              <div className="relative">
                <select
                  value={configurationType === 'QBUSINESS' ? selectedQbDataSource : ''}
                  onChange={(e) => {
                    const newDataSourceId = e.target.value;
                    if (configurationType === 'QBUSINESS') {
                      setSelectedQbDataSource(newDataSourceId);
                      // Reset dependent fields when data source changes
                      setSelectedQbSyncJob('');
                      // Clear data arrays
                      setQbSyncJobs([]);
                    }
                  }}
                  className="appearance-none w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={
                    configurationType === 'QBUSINESS' && (!selectedQbIndex || loadingQbDataSources)
                  }
                >
                  <option value="">Select Data Source</option>
                  {qbDataSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </select>
                {(configurationType === 'QBUSINESS' && loadingQbDataSources) ||
                configurationType === 'KENDRA' ? (
                  <Loader2 className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
                ) : (
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                )}
              </div>
            </div>

            {/* Sync Job Selector */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Sync Job</label>
              <div className="relative">
                <select
                  value={selectedQbSyncJob}
                  onChange={(e) => setSelectedQbSyncJob(e.target.value)}
                  className="appearance-none w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={
                    configurationType === 'QBUSINESS' &&
                    (!selectedQbDataSource || loadingQbSyncJobs)
                  }
                >
                  <option value="">Select Sync Job</option>
                  {qbSyncJobs.map((job) => (
                    <option key={job.executionId} value={job.executionId}>
                      {job.displayName}
                    </option>
                  ))}
                </select>
                <Loader2 className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
              </div>
            </div>
          </div>

          {/* Apply Button */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={updateConfiguration}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Apply Configuration
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-800/50 rounded-lg">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Temporary Message */}
          {tempMessage && (
            <div className="mt-4 p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg">
              <p className="text-sm text-blue-300">{tempMessage}</p>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-800">
        <div className="container mx-auto px-6">
          <nav className="flex gap-6">
            {getTabs()
              .filter((tab) => tab.show)
              .map((tab) => (
                <TabButton
                  key={tab.id}
                  active={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </TabButton>
              ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8">
        {!isConfigurationComplete() ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Database className="w-16 h-16 text-gray-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-300 mb-2">Configuration Incomplete</h2>
            <p className="text-gray-400 max-w-lg mb-6">
              {configurationType === 'QBUSINESS'
                ? 'Please complete your configuration by selecting an Application, Index, and Data Source to view dashboard content.'
                : 'Please complete your configuration by selecting an Index and Data Source to view dashboard content.'}
            </p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Complete Configuration
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'metrics' && (
              <SyncMetricsComponent
                applicationId={selectedQbApplication}
                syncJobId={selectedQbSyncJob}
                indexId={selectedQbIndex}
                dataSourceId={selectedQbDataSource}
              />
            )}

            {/* Group Membership Component removed */}

            {activeTab === 'acl' && (
              <ACLViewerComponent
                config={
                  {
                    type: 'QBUSINESS',
                    applicationId: selectedQbApplication,
                    indexId: selectedQbIndex,
                    dataSourceId: selectedQbDataSource,
                    syncJobId: selectedQbSyncJob || '',
                    syncJobExecutionId: selectedQbSyncJob || '',
                    retrieverId:
                      qbApplications.find((app) => app.applicationId === selectedQbApplication)
                        ?.retrieverId || '',
                    syncJobStartTime: qbSyncJobs.find(
                      (job) => job.executionId === selectedQbSyncJob,
                    )?.startTime,
                    syncJobEndTime: qbSyncJobs.find((job) => job.executionId === selectedQbSyncJob)
                      ?.endTime,
                  } as QBusinessConfig
                }
              />
            )}

            {isQBusinessConfig && activeTab === 'access' && (
              <AccessCheckerComponent
                config={
                  {
                    type: 'QBUSINESS',
                    applicationId: selectedQbApplication,
                    indexId: selectedQbIndex,
                    dataSourceId: selectedQbDataSource,
                    syncJobId: selectedQbSyncJob || '',
                    syncJobExecutionId: selectedQbSyncJob || '',
                    retrieverId:
                      qbApplications.find((app) => app.applicationId === selectedQbApplication)
                        ?.retrieverId || '',
                    syncJobStartTime: qbSyncJobs.find(
                      (job) => job.executionId === selectedQbSyncJob,
                    )?.startTime,
                    syncJobEndTime: qbSyncJobs.find((job) => job.executionId === selectedQbSyncJob)
                      ?.endTime,
                  } as QBusinessConfig
                }
              />
            )}

            {activeTab === 'errors' && (
              <SyncErrorsComponent
                config={
                  {
                    type: 'QBUSINESS',
                    applicationId: selectedQbApplication,
                    indexId: selectedQbIndex,
                    dataSourceId: selectedQbDataSource,
                    syncJobId: selectedQbSyncJob || '',
                    syncJobExecutionId: selectedQbSyncJob || '',
                    retrieverId:
                      qbApplications.find((app) => app.applicationId === selectedQbApplication)
                        ?.retrieverId || '',
                    syncJobStartTime: qbSyncJobs.find(
                      (job) => job.executionId === selectedQbSyncJob,
                    )?.startTime,
                    syncJobEndTime: qbSyncJobs.find((job) => job.executionId === selectedQbSyncJob)
                      ?.endTime,
                  } as QBusinessConfig
                }
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, children }) => {
  return (
    <button
      onClick={onClick}
      className={`py-4 px-2 border-b-2 transition-all ${
        active
          ? 'border-purple-500 text-purple-400'
          : 'border-transparent text-gray-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
};

export default Dashboard;
