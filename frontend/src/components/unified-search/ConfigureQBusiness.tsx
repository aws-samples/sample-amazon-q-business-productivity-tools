// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { CheckSquare, BarChart2, Check, X, Database, Puzzle, Loader, Play, Download } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { convertJsonFormat } from '../../bedrock/mbeConverter';
import { qBusinessProxyChatService } from '../../services';
import { credentialExchangeProxyService } from '../../services/proxy/CredentialExchangeProxyService';
import { qBusinessProxyService, DataSource } from '../../services/proxy/QBusinessProxyService';
import { Config } from '../../types/types';
import { createDataSourceFilter } from '../../utils/helpter';

// Define a local SyncJob interface that matches what we need

// Import the convertJsonFormat function dynamically

interface SyncJob {
  executionId: string;
  displayName: string;
  startTime: Date;
  endTime?: Date;
  status: string;
  metrics?: {
    documentsAdded?: number;
    documentsModified?: number;
    documentsDeleted?: number;
    documentsFailed?: number;
    documentsScanned?: number;
  };
}

interface GroundTruthData {
  prompt: string;
  groundTruth: string;
}

interface EvaluationResult {
  prompt: string;
  groundTruth: string;
  response: string;
  status: 'pending' | 'completed' | 'error';
  error?: string;
  citations?: {
    title: string;
    uri: string;
    snippet?: string;
  }[];
}

interface Plugin {
  id: string;
  name: string;
  enabled: boolean;
  icon: string;
}

interface ConfigureQBusinessProps {
  fileData: GroundTruthData[];
  evaluationResults: EvaluationResult[];
  setEvaluationResults: React.Dispatch<React.SetStateAction<EvaluationResult[]>>;
  isEvaluating: boolean;
  setIsEvaluating: React.Dispatch<React.SetStateAction<boolean>>;
  currentEvaluationIndex: number;
  setCurrentEvaluationIndex: React.Dispatch<React.SetStateAction<number>>;
  evaluationComplete: boolean;
  setEvaluationComplete: React.Dispatch<React.SetStateAction<boolean>>;
  onContinue: () => void;
}

const ConfigureQBusiness: React.FC<ConfigureQBusinessProps> = ({
  fileData,
  evaluationResults,
  setEvaluationResults,
  isEvaluating,
  setIsEvaluating,
  currentEvaluationIndex,
  setCurrentEvaluationIndex,
  evaluationComplete,
  setEvaluationComplete,
  onContinue,
}) => {
  // QBusiness state
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [selectedDataSources, setSelectedDataSources] = useState<string[]>([]);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [applications, setApplications] = useState<
    {
      applicationId: string;
      displayName: string;
      createdAt?: Date;
      updatedAt?: Date;
      status?: string;
      retrieverId: string;
      indexId?: string;
    }[]
  >([]);
  const [qbSyncJobs] = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<string>('');
  const [selectedIndexId, setSelectedIndexId] = useState<string>('');
  const [selectedQbSyncJob] = useState<string>('');
  const [letOrchestratorDecide, setLetOrchestratorDecide] = useState<boolean>(false);
  // Store previous selections when "Let Orchestrator Decide" is checked
  const [previousDataSources, setPreviousDataSources] = useState<string[]>([]);
  const [previousPlugin, setPreviousPlugin] = useState<string | null>(null);

  // Function to handle downloading responses
  const handleDownloadResponses = () => {
    if (!evaluationComplete || evaluationResults.length === 0) return;

    // Format the data for download
    const downloadData = evaluationResults.map(result => ({
      prompt: result.prompt,
      groundTruth: result.groundTruth,
      response: result.response,
      citations: result.citations,
    }));

    // Convert to JSON string
    const jsonString = JSON.stringify(downloadData, null, 2);
    
    // Create a blob with the data
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    // Create a URL for the blob
    const url = URL.createObjectURL(blob);
    
    // Create a temporary anchor element
    const a = document.createElement('a');
    a.href = url;
    
    // Generate a filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `qbusiness-responses-${timestamp}.json`;
    
    // Append to the document, click it, and remove it
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Release the URL object
    URL.revokeObjectURL(url);
  };

  // Helper function to fetch data sources and plugins
  const fetchDataSourcesAndPlugins = async (applicationId: string, indexId: string) => {
    try {
      // Fetch data sources for the configured index and application
      const sourcesResponse = await qBusinessProxyService.listDataSources(applicationId, indexId);
      const sources = sourcesResponse.success && sourcesResponse.data ? sourcesResponse.data : [];
      setDataSources(sources);

      // Get the config from local storage
      const savedConfig = localStorage.getItem('application-configuration');
      let configData: Config | null = null;

      if (savedConfig) {
        try {
          configData = JSON.parse(savedConfig);
        } catch (error) {
          console.error('Failed to parse saved config:', error);
        }
      }

      // If we have a saved config with a dataSourceId, use it to pre-select the data source
      if (configData && configData.dataSourceId) {
        setSelectedDataSources([configData.dataSourceId]);
      } else {
        // Otherwise initialize all data sources as selected by default
        setSelectedDataSources(sources.map((source) => source.id));
      }

      // Fetch plugins for the configured application
      const pluginsResponse = await qBusinessProxyService.listPlugins(applicationId);
      const pluginsData =
        pluginsResponse.success && pluginsResponse.data ? pluginsResponse.data : [];
      const formattedPlugins = pluginsData.map((plugin, index) => {
        // Map colors based on index to ensure variety
        const iconColors = ['purple', 'blue', 'green', 'orange', 'red'];
        const colorIndex = index % iconColors.length;

        return {
          id: plugin.id,
          name: plugin.name,
          enabled: true, // Default to enabled
          icon: iconColors[colorIndex],
        };
      });
      setPlugins(formattedPlugins);
    } catch (error) {
      console.error('Error fetching data sources and plugins:', error);
      setError('Failed to load data sources and plugins.');
    }
  };

  const groundTruthWithResponse = (apiResponse: any, prompt: string, groundTruth: string) => {
    return {
      prompt: prompt,
      groundTruth: groundTruth,
      response: apiResponse.message || '',
      conversation_id: apiResponse.chatId || '',
      user_message_id: '', // Use empty string since userMessageId doesn't exist in ChatResponse
      system_message_id: apiResponse.systemMessageId || '',
      sourceAttributions: apiResponse.sourceAttribution || [],
    };
  };

  // Function to handle starting the evaluation process
  const handleStartEvaluation = async () => {
    if (!selectedApplication || isEvaluating || fileData.length === 0) return;

    // Initialize evaluation state
    setIsEvaluating(true);
    setEvaluationComplete(false);
    setCurrentEvaluationIndex(0);

    // Create initial results array with pending status
    const initialResults = fileData.map((item) => ({
      prompt: item.prompt,
      groundTruth: item.groundTruth,
      response: '',
      status: 'pending' as const,
    }));
    setEvaluationResults(initialResults);

    // Array to store ChatSyncResponse objects
    const chatSyncResponses = [];

    // Process each prompt sequentially
    for (let i = 0; i < fileData.length; i++) {
      setCurrentEvaluationIndex(i);

      try {
        // Create a message object for the chatSync API
        const message = {
          role: 'user' as const,
          content: fileData[i].prompt,
        };

        // Get the cognito session ID if available
        const cognitoSessionId = credentialExchangeProxyService.getCognitoSessionId() || undefined;

        // Prepare request parameters
        const requestParams: any = {
          messages: [message],
          conversationId: undefined,
          systemMessageId: undefined,
          ...(cognitoSessionId && { sessionId: cognitoSessionId }),
        };

        // Only set attributeFilter or selectedPlugin if not letting orchestrator decide
        if (!letOrchestratorDecide) {
          // Add attribute filter if data sources are selected
          if (selectedDataSources.length > 0) {
            requestParams.attributeFilter = createDataSourceFilter(selectedDataSources);
          }
          
          // Add selected plugin if one is selected
          if (selectedPlugin) {
            requestParams.selectedPlugin = selectedPlugin;
          }
        }

        // Call the chatSync API using the proxy service
        const response = await qBusinessProxyChatService.chatSync(selectedApplication, requestParams);

        if (!response.success || !response.data) {
          throw new Error('Failed to get AI response');
        }

        const chatResponse = response.data;

        // Update the results array with the response
        setEvaluationResults((prev) => {
          const updated = [...prev];
          updated[i] = {
            ...updated[i],
            response: chatResponse.message,
            citations: chatResponse.citations,
            status: 'completed',
          };
          return updated;
        });

        // Convert to ChatSyncResponse and add to array
        const chatSyncResponse = groundTruthWithResponse(
          chatResponse,
          fileData[i].prompt,
          fileData[i].groundTruth,
        );
        chatSyncResponses.push(chatSyncResponse);
      } catch (error) {
        console.error(`Error evaluating prompt ${i + 1}:`, error);

        // Update the results array with the error
        setEvaluationResults((prev) => {
          const updated = [...prev];
          updated[i] = {
            ...updated[i],
            error: error instanceof Error ? error.message : 'Unknown error',
            status: 'error',
          };
          return updated;
        });
      }

      // Small delay to prevent overwhelming the API
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Mark evaluation as complete
    setIsEvaluating(false);
    setEvaluationComplete(true);

    // Convert each ChatSyncResponse to Mbe format
    const mbeResponses = chatSyncResponses.map((response) => {
      try {
        return convertJsonFormat(response);
      } catch (error) {
        console.error('Error converting to MBE format:', error);
        return response;
      }
    });

    // Convert to string with each Mbe on a new line
    const output = mbeResponses.map((obj) => JSON.stringify(obj)).join('\n');

    // Store the responses for later S3 upload
    localStorage.setItem('mbe-responses', output);

    return chatSyncResponses;
  };

  // Fetch QBusiness applications
  useEffect(() => {
    const fetchApplications = async () => {
      try {
        setLoading(true);

        // Get the config from local storage
        const savedConfig = localStorage.getItem('application-configuration');
        let configData: Config | null = null;

        if (savedConfig) {
          try {
            configData = JSON.parse(savedConfig);
            setConfig(configData);

            // Set the selected application from the config
            if (configData!.applicationId) {
              setSelectedApplication(configData!.applicationId);
            }
          } catch (error) {
            console.error('Failed to parse saved config:', error);
          }
        }

        // Fetch applications using the proxy service
        const appsResponse = await qBusinessProxyService.listApplications();
        const proxyApps = appsResponse.success && appsResponse.data ? appsResponse.data : [];

        // No longer filtering applications based on user-mode
        // Show all applications regardless of identity type

        // Convert the applications to the format expected by the component
        const formattedApps = proxyApps.map((app) => ({
          applicationId: app.applicationId,
          displayName: app.displayName,
          createdAt: app.createdAt ? new Date(app.createdAt) : undefined,
          updatedAt: app.updatedAt ? new Date(app.updatedAt) : undefined,
          status: app.status,
          retrieverId: app.retrieverId,
          indexId: app.indexId, // Include the indexId from the API response
        }));

        setApplications(formattedApps);
      } catch (err) {
        console.error('Error fetching applications:', err);
        setError('Failed to load applications. Please check your AWS credentials and permissions.');
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, []);

  // Fetch data sources and plugins when application changes or on initial load
  useEffect(() => {
    const fetchDataForSelectedApp = async () => {
      // Skip if no application is selected or applications array is empty
      if (!selectedApplication || applications.length === 0) {
        if (!selectedApplication) {
          setDataSources([]);
          setPlugins([]);
          setSelectedDataSources([]);
          setSelectedPlugin(null);
        }
        return;
      }

      setLoading(true);
      setError(null); // Clear any previous errors

      try {
        // Get the selected application object
        const selectedApp = applications.find((app) => app.applicationId === selectedApplication);
        if (!selectedApp) {
          console.error('Selected application not found in applications list');
          setError('Selected application not found');
          setLoading(false);
          return;
        }

        // Get the index ID directly from the application
        // QBusiness Application and Index have a one-to-one mapping
        const indexId = selectedIndexId || selectedApp.indexId || selectedApp.retrieverId;

        if (!indexId) {
          console.error('No index ID found for the selected application');
          setError('No index ID found for the selected application');
          setLoading(false);
          return;
        }

        // Update selectedIndexId if it's not already set
        if (!selectedIndexId && selectedApp.indexId) {
          setSelectedIndexId(selectedApp.indexId);
        }

        console.log(
          `Fetching data sources and plugins for application ${selectedApplication} and index ${indexId}`,
        );

        // Reset selections when changing applications
        setSelectedDataSources([]);
        setSelectedPlugin(null);

        // Fetch data sources and plugins for the selected application
        console.log('fetching ds and plugins for ', selectedApplication, indexId);
        await fetchDataSourcesAndPlugins(selectedApplication, indexId);
      } catch (err) {
        console.error('Error fetching data for selected application:', err);
        setError('Failed to load data sources and plugins for the selected application.');
      } finally {
        setLoading(false);
      }
    };

    fetchDataForSelectedApp();
  }, [selectedApplication, applications, selectedIndexId]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-gray-900/50 backdrop-blur-lg rounded-2xl p-8 border border-gray-800 mb-8">
        <h2 className="text-xl font-semibold mb-6 text-gray-200">Configure QBusiness</h2>

        {/* Step 1: Select QBusiness Configuration */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">
            STEP 1: QBUSINESS CONFIGURATION
          </h3>

          {/* Application & Index Selection Card */}
          <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700 mb-6">
            <div className="flex items-center mb-4">
              <Database className="h-5 w-5 text-purple-400 mr-2" />
              <h4 className="text-base font-medium text-gray-200">Application & Index</h4>
            </div>

            {/* Application Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                QBusiness Application
              </label>
              <div className="relative">
                <select
                  className="block w-full px-4 py-3 bg-gray-900/50 backdrop-blur-lg border border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white appearance-none"
                  value={selectedApplication}
                  onChange={(e) => {
                    const appId = e.target.value;
                    setSelectedApplication(appId);

                    // Automatically update the indexId when application changes
                    if (appId) {
                      const selectedApp = applications.find((app) => app.applicationId === appId);
                      if (selectedApp && selectedApp.indexId) {
                        setSelectedIndexId(selectedApp.indexId);
                      }
                    } else {
                      setSelectedIndexId('');
                    }
                  }}
                  disabled={loading || !config}
                >
                  <option value="">Select Application</option>
                  {applications.map((app) => (
                    <option key={app.applicationId} value={app.applicationId}>
                      {app.displayName}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </div>
              </div>
              {loading && (
                <div className="flex items-center mt-2 text-sm text-gray-400">
                  <Loader className="h-3 w-3 animate-spin mr-2" />
                  <span>Loading applications...</span>
                </div>
              )}
            </div>

            {/* Index Display */}
            {selectedApplication && selectedIndexId && (
              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
                <div className="flex items-center">
                  <Check className="h-4 w-4 text-green-400 mr-2" />
                  <div>
                    <h5 className="text-xs font-medium text-gray-300">Selected Index</h5>
                    <p className="text-xs text-gray-400">{selectedIndexId}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Data Source & Plugin Selection */}
          <h3 className="text-sm font-semibold text-gray-400 mb-3">
            STEP 2: DATA SOURCE & PLUGIN SELECTION
          </h3>

          <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700 mb-6">
            <div className="flex items-center mb-4">
              <Puzzle className="h-5 w-5 text-blue-400 mr-2" />
              <h4 className="text-base font-medium text-gray-200">Select Data Source or Plugin</h4>
            </div>

            <div className="mb-4 text-sm text-gray-400">
              <p>Choose either data sources or a plugin to use for evaluation:</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Data Sources Panel */}
              <div
                className={`p-4 rounded-xl border ${selectedDataSources.length > 0 ? 'border-purple-500/50 bg-purple-900/10' : 'border-gray-700 bg-gray-900/30'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Database className="h-4 w-4 text-purple-400 mr-2" />
                    <h4 className="text-sm font-medium text-gray-300">Data Sources</h4>
                  </div>
                  {selectedDataSources.length > 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-900/50 text-purple-300">
                      {selectedDataSources.length} selected
                    </span>
                  )}
                </div>

                {loading ? (
                  <div className="flex items-center justify-center p-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-500"></div>
                  </div>
                ) : error ? (
                  <div className="text-red-400 text-sm p-2">{error}</div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {dataSources.length > 0 ? (
                      dataSources.map((source) => (
                        <div
                          key={source.id}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                            selectedDataSources.includes(source.id)
                              ? 'bg-purple-900/30 border border-purple-500/50'
                              : 'bg-gray-800/50 hover:bg-gray-700/50'
                          }`}
                          onClick={() => {
                            if (selectedDataSources.includes(source.id)) {
                              setSelectedDataSources((prev) =>
                                prev.filter((id) => id !== source.id),
                              );
                            } else {
                              // When a data source is selected, deselect any selected plugin
                              setSelectedPlugin(null);
                              setSelectedDataSources((prev) => [...prev, source.id]);
                            }
                          }}
                        >
                          <div className="flex items-center">
                            <Database className="h-4 w-4 text-purple-400 mr-2" />
                            <span className="text-sm">{source.name}</span>
                          </div>
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-purple-500"
                            checked={selectedDataSources.includes(source.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-400 text-sm p-2">No data sources found</div>
                    )}
                  </div>
                )}
              </div>

              {/* Plugins Panel */}
              <div
                className={`p-4 rounded-xl border ${selectedPlugin ? 'border-blue-500/50 bg-blue-900/10' : 'border-gray-700 bg-gray-900/30'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Puzzle className="h-4 w-4 text-blue-400 mr-2" />
                    <h4 className="text-sm font-medium text-gray-300">Plugins</h4>
                  </div>
                  {selectedPlugin && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-900/50 text-blue-300">
                      1 selected
                    </span>
                  )}
                </div>

                {loading ? (
                  <div className="flex items-center justify-center p-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : error ? (
                  <div className="text-red-400 text-sm p-2">{error}</div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {plugins.length > 0 ? (
                      plugins.map((plugin) => (
                        <div
                          key={plugin.id}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                            selectedPlugin === plugin.id
                              ? 'bg-blue-900/30 border border-blue-500/50'
                              : 'bg-gray-800/50 hover:bg-gray-700/50'
                          }`}
                          onClick={() => {
                            if (selectedPlugin === plugin.id) {
                              setSelectedPlugin(null);
                            } else {
                              // When a plugin is selected, deselect all data sources
                              setSelectedDataSources([]);
                              setSelectedPlugin(plugin.id);
                            }
                          }}
                        >
                          <div className="flex items-center">
                            <Puzzle className={`h-4 w-4 text-${plugin.icon}-400 mr-2`} />
                            <span className="text-sm">{plugin.name}</span>
                          </div>
                          <input
                            type="radio"
                            name="plugin"
                            className="h-4 w-4 accent-blue-500"
                            checked={selectedPlugin === plugin.id}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          />
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-400 text-sm p-2">No plugins found</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Let Orchestrator Decide Option */}
            <div className="mt-4 p-4 rounded-xl border border-gray-700 bg-gray-900/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="mr-3">
                    <input
                      type="checkbox"
                      id="orchestrator-decide"
                      className="h-4 w-4 accent-teal-500"
                      checked={letOrchestratorDecide}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setLetOrchestratorDecide(isChecked);
                        
                        if (isChecked) {
                          // Store current selections before clearing them
                          setPreviousDataSources([...selectedDataSources]);
                          setPreviousPlugin(selectedPlugin);
                          
                          // Clear selections when letting orchestrator decide
                          setSelectedDataSources([]);
                          setSelectedPlugin(null);
                        } else {
                          // Restore previous selections when unchecking
                          if (previousPlugin) {
                            setSelectedPlugin(previousPlugin);
                          } else if (previousDataSources.length > 0) {
                            setSelectedDataSources(previousDataSources);
                          } else if (dataSources.length > 0) {
                            // If no previous selection, select the first data source as default
                            setSelectedDataSources([dataSources[0].id]);
                          }
                        }
                      }}
                    />
                  </div>
                  <div>
                    <label htmlFor="orchestrator-decide" className="text-sm font-medium text-gray-300 cursor-pointer">
                      Let Orchestrator Decide
                    </label>
                    <p className="text-xs text-gray-400 mt-1">
                      QBusiness orchestrator will automatically determine whether to use data sources or plugins
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Selection Summary */}
            <div className="mt-4 p-3 bg-gray-900/50 rounded-lg border border-gray-800">
              <h5 className="text-xs font-medium text-gray-300 mb-1">Current Selection</h5>
              {letOrchestratorDecide ? (
                <p className="text-xs text-teal-400">
                  <Check className="h-3 w-3 inline mr-1" />
                  Letting QBusiness orchestrator decide
                </p>
              ) : selectedDataSources.length > 0 ? (
                <p className="text-xs text-green-400">
                  <Check className="h-3 w-3 inline mr-1" />
                  Using {selectedDataSources.length} data source
                  {selectedDataSources.length !== 1 ? 's' : ''}
                </p>
              ) : selectedPlugin ? (
                <p className="text-xs text-green-400">
                  <Check className="h-3 w-3 inline mr-1" />
                  Using plugin: {plugins.find((p) => p.id === selectedPlugin)?.name}
                </p>
              ) : (
                <p className="text-xs text-yellow-400">No data sources or plugins selected</p>
              )}
            </div>
          </div>

          {/* Optional: Sync Job Selection (collapsed by default) */}
          {selectedDataSources.length > 0 && (
            <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 mb-6">
              <details>
                <summary className="flex items-center cursor-pointer">
                  <span className="text-sm font-medium text-gray-300">
                    Advanced: Sync Job Selection
                  </span>
                  <span className="ml-2 text-xs text-gray-400">(Optional)</span>
                </summary>
                <div className="mt-3 space-y-4">
                  {/* Display selected sync job if available */}
                  {selectedQbSyncJob && (
                    <div className="p-3 bg-gray-900/50 rounded-lg border border-gray-800">
                      <div className="flex items-center">
                        <Check className="h-4 w-4 text-green-400 mr-2" />
                        <div>
                          <h5 className="text-xs font-medium text-gray-300">Selected Sync Job</h5>
                          <p className="text-xs text-gray-400">
                            {qbSyncJobs.find((job) => job.executionId === selectedQbSyncJob)
                              ?.displayName || selectedQbSyncJob}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </details>
            </div>
          )}
        </div>

        {/* Step 3: Generate QBusiness Response */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">
            STEP 3: GENERATE QBUSINESS RESPONSE
          </h3>

          <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700 mb-6">
            <div className="flex items-center mb-4">
              <Play className="h-5 w-5 text-green-400 mr-2" />
              <h4 className="text-base font-medium text-gray-200">Start Evaluation</h4>
            </div>

            <div className="mb-4 text-sm text-gray-400">
              <p>Generate QBusiness responses for all prompts in your dataset.</p>
            </div>

            {/* Validation Status */}
            <div className="mb-4 p-3 rounded-lg border border-gray-700 bg-gray-900/50">
              <h5 className="text-xs font-medium text-gray-300 mb-2">Evaluation Status</h5>
              <ul className="space-y-2">
                <li className="flex items-center text-xs">
                  {selectedApplication ? (
                    <Check className="h-3 w-3 text-green-400 mr-2" />
                  ) : (
                    <X className="h-3 w-3 text-red-400 mr-2" />
                  )}
                  <span className={selectedApplication ? 'text-green-400' : 'text-red-400'}>
                    QBusiness Application {selectedApplication ? 'Selected' : 'Required'}
                  </span>
                </li>
                <li className="flex items-center text-xs">
                  {selectedDataSources.length > 0 || selectedPlugin || letOrchestratorDecide ? (
                    <Check className="h-3 w-3 text-green-400 mr-2" />
                  ) : (
                    <X className="h-3 w-3 text-red-400 mr-2" />
                  )}
                  <span
                    className={
                      selectedDataSources.length > 0 || selectedPlugin || letOrchestratorDecide
                        ? 'text-green-400'
                        : 'text-red-400'
                    }
                  >
                    {letOrchestratorDecide 
                      ? 'Orchestrator will decide data sources/plugins'
                      : `Data Source or Plugin ${selectedDataSources.length > 0 || selectedPlugin ? 'Selected' : 'Required'}`
                    }
                  </span>
                </li>
                <li className="flex items-center text-xs">
                  {fileData.length > 0 ? (
                    <Check className="h-3 w-3 text-green-400 mr-2" />
                  ) : (
                    <X className="h-3 w-3 text-red-400 mr-2" />
                  )}
                  <span className={fileData.length > 0 ? 'text-green-400' : 'text-red-400'}>
                    {fileData.length} Prompts {fileData.length > 0 ? 'Loaded' : 'Required'}
                  </span>
                </li>
              </ul>
            </div>

            <div className="flex justify-end">
              <button
                className={`px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl text-white font-medium hover:from-purple-600 hover:to-blue-600 transition-all flex items-center ${isEvaluating || !selectedApplication || !(selectedDataSources.length > 0 || selectedPlugin || letOrchestratorDecide) ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={handleStartEvaluation}
                disabled={
                  isEvaluating ||
                  !selectedApplication ||
                  !(selectedDataSources.length > 0 || selectedPlugin || letOrchestratorDecide)
                }
              >
                {isEvaluating ? (
                  <>
                    <Loader className="animate-spin h-4 w-4 mr-2" />
                    Evaluating ({currentEvaluationIndex + 1}/{fileData.length})
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Generate QBusiness Responses
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Q Business Response Table */}
        {evaluationResults.length > 0 && (
          <div className="bg-gray-900/50 backdrop-blur-lg rounded-2xl p-8 border border-gray-800 mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-200">Q Business Responses</h2>
              {evaluationComplete && (
                <div className="flex items-center text-green-400">
                  <Check className="h-5 w-5 mr-2" />
                  <span>All Responses Generated</span>
                </div>
              )}
              {isEvaluating && (
                <div className="flex items-center text-yellow-400">
                  <Loader className="animate-spin h-5 w-5 mr-2" />
                  <span>
                    Generating ({currentEvaluationIndex + 1}/{fileData.length})
                  </span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-400">#</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-400">
                      Prompt
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-400">
                      Response
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-400">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {evaluationResults.map((result, index) => (
                    <tr key={index} className="border-b border-gray-800">
                      <td className="py-3 px-4 text-gray-400">{index + 1}</td>
                      <td className="py-3 px-4 text-gray-300 max-w-[200px] truncate">
                        {result.prompt}
                      </td>
                      <td className="py-3 px-4 text-gray-300 max-w-[300px] truncate">
                        {result.status === 'pending' ? (
                          <span className="text-yellow-500">Pending...</span>
                        ) : result.status === 'error' ? (
                          <span className="text-red-500">{result.error || 'Error'}</span>
                        ) : (
                          result.response
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {result.status === 'pending' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-900/30 text-yellow-300">
                            <Loader className="animate-spin h-3 w-3 mr-1" />
                            Pending
                          </span>
                        ) : result.status === 'error' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900/30 text-red-300">
                            <X className="h-3 w-3 mr-1" />
                            Error
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900/30 text-green-300">
                            <Check className="h-3 w-3 mr-1" />
                            Completed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Continue and Download Buttons */}
        <div className="mb-6">
          <div className="flex justify-end space-x-4">
            <button
              className={`px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl text-white font-medium hover:from-blue-600 hover:to-indigo-600 transition-all flex items-center ${!evaluationComplete ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!evaluationComplete}
              onClick={handleDownloadResponses}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Responses
            </button>
            <button
              className={`px-6 py-3 bg-gradient-to-r from-green-500 to-teal-500 rounded-xl text-white font-medium hover:from-green-600 hover:to-teal-600 transition-all flex items-center ${!evaluationComplete ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!evaluationComplete}
              onClick={onContinue}
            >
              <BarChart2 className="h-4 w-4 mr-2" />
              Continue to Evaluation
            </button>
          </div>
        </div>
      </div>

      {/* Placeholder when no evaluation results */}
      {evaluationResults.length === 0 && (
        <div className="bg-gray-900/30 backdrop-blur-sm p-6 rounded-xl border border-gray-800 text-center">
          <CheckSquare className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-300 mb-2">Ready to Evaluate</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            Configure your evaluation settings and click "Generate Q Business Response" to begin the
            process.
          </p>
        </div>
      )}
    </div>
  );
};

export default ConfigureQBusiness;
