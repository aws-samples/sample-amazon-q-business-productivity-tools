// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import {
  MessageSquare,
  Send,
  Database,
  Puzzle,
  Loader,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';

import { credentialExchangeProxyService } from '../../services/proxy/CredentialExchangeProxyService';
import {
  ChatMessage,
  qBusinessProxyChatService,
  StreamingChatResponse,
} from '../../services/proxy/QBusinessProxyChatService';
import {
  qBusinessProxyService,
  DataSource,
  Application,
} from '../../services/proxy/QBusinessProxyService';
import { Config, QBusinessConfig } from '../../types/types';
import { createDataSourceFilter } from '../../utils/helpter';

interface Plugin {
  id: string;
  name: string;
  enabled: boolean;
  icon: string;
}
const ChatBot: React.FC = () => {
  const [message, setMessage] = useState('');
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [selectedDataSources, setSelectedDataSources] = useState<string[]>([]);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  // Removed activeSection state as we'll show both sections simultaneously
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [systemMessageId, setSystemMessageId] = useState<string | undefined>(undefined);
  const [isChatting, setIsChatting] = useState(false);

  // Chat mode state (streaming)
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [streamingCitations, setStreamingCitations] = useState<any[]>([]);

  // Interface for citations
  interface Citation {
    title: string;
    uri: string;
    snippet?: string;
  }

  // Handle starting a new session
  const handleStartNewSession = () => {
    // Clear chat messages
    setChatMessages([]);

    // Reset conversation and system message IDs
    setConversationId(undefined);
    setSystemMessageId(undefined);

    // Reset data source selections to default (all data sources selected)
    setSelectedDataSources(dataSources.map((source) => source.id));

    // Clear plugin selection
    setSelectedPlugin(null);
  };

  // Process a streaming response chunk
  const processStreamChunk = (chunk: string) => {
    try {
      // Split the chunk by newlines to handle multiple events
      const events = chunk.split('\n\n').filter((event) => event.trim().startsWith('data: '));

      for (const event of events) {
        // Extract the JSON data from the event
        const jsonStr = event.replace('data: ', '');
        const data: StreamingChatResponse = JSON.parse(jsonStr);

        // Process different event types
        if (data.type === 'text' && data.content) {
          // Append text content to the streaming message
          setStreamingMessage((prev) => {
            const updatedMessage = prev + data.content;

            // Also update the chat messages array with the current streaming content
            // This ensures the message is always in the chat history, even if 'complete' event fails
            setChatMessages((prevMessages) => {
              const newMessages = [...prevMessages];
              // Find if we already have a streaming message in the chat history
              const streamingIndex = newMessages.findIndex(
                (msg) => msg.role === 'assistant' && msg.isStreaming === true,
              );

              if (streamingIndex >= 0) {
                // Update the existing streaming message
                newMessages[streamingIndex] = {
                  ...newMessages[streamingIndex],
                  content: updatedMessage,
                  isStreaming: true,
                };
              } else {
                // Add a new streaming message
                newMessages.push({
                  role: 'assistant',
                  content: updatedMessage,
                  isStreaming: true,
                  citations: streamingCitations.length > 0 ? [...streamingCitations] : undefined,
                });
              }
              return newMessages;
            });

            return updatedMessage;
          });

          // Update conversation and system message IDs if available
          if (data.conversationId) {
            setConversationId(data.conversationId);
          }
          if (data.systemMessageId) {
            setSystemMessageId(data.systemMessageId);
          }
        } else if (data.type === 'metadata') {
          // Store source attributions for citations
          if (data.sourceAttributions) {
            const citations = data.sourceAttributions.map((source, index) => ({
              title: source.title || `Source ${index + 1}`,
              uri: source.url || '#',
              snippet: source.snippet || undefined,
            }));

            setStreamingCitations(citations);

            // Update citations in the streaming message in chat history
            setChatMessages((prevMessages) => {
              const newMessages = [...prevMessages];
              // Find if we already have a streaming message in the chat history
              const streamingIndex = newMessages.findIndex(
                (msg) => msg.role === 'assistant' && msg.isStreaming === true,
              );

              if (streamingIndex >= 0) {
                // Update the existing streaming message with citations
                newMessages[streamingIndex] = {
                  ...newMessages[streamingIndex],
                  citations: citations.length > 0 ? citations : undefined,
                };
              }
              return newMessages;
            });
          }

          // Update conversation and system message IDs if available
          if (data.conversationId) {
            setConversationId(data.conversationId);
          }
          if (data.systemMessageId) {
            setSystemMessageId(data.systemMessageId);
          }
        } else if (data.type === 'complete') {
          // Mark the streaming message as complete in the chat history
          setChatMessages((prevMessages) => {
            const newMessages = [...prevMessages];
            // Find the streaming message
            const streamingIndex = newMessages.findIndex(
              (msg) => msg.role === 'assistant' && msg.isStreaming === true,
            );

            if (streamingIndex >= 0) {
              // Update the message to mark it as no longer streaming
              newMessages[streamingIndex] = {
                ...newMessages[streamingIndex],
                isStreaming: false,
              };
            } else {
              // If no streaming message was found, add the final message
              newMessages.push({
                role: 'assistant',
                content: streamingMessage,
                citations: streamingCitations.length > 0 ? [...streamingCitations] : undefined,
                isStreaming: false,
              });
            }
            return newMessages;
          });

          // Reset streaming state
          setStreamingMessage('');
          setStreamingCitations([]);
          setIsChatting(false);

          // Update conversation and system message IDs if available
          if (data.conversationId) {
            setConversationId(data.conversationId);
          }
          if (data.systemMessageId) {
            setSystemMessageId(data.systemMessageId);
          }
        } else if (data.type === 'error') {
          // Handle error
          console.error('Streaming Error:', data.message);
          
          // Check if the error is due to expired security token
          const isExpiredToken = data.message && 
            data.message.includes("security token included in the request is expired");
          
          // Set appropriate error message
          const errorMessage = isExpiredToken 
            ? 'Your AWS credentials have expired. Please sign out and sign back in to continue.'
            : (data.message || 'An error occurred during streaming');
          
          setError(errorMessage);
          setIsChatting(false);

          // Add error message to chat
          setChatMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: isExpiredToken 
                ? 'Your AWS credentials have expired. Please sign out and sign back in to continue.'
                : 'Sorry, there was an error processing your message. Please try again.',
            },
          ]);

          // Reset streaming state
          setStreamingMessage('');
          setStreamingCitations([]);
        }
      }
    } catch (error) {
      console.error('Error processing stream chunk:', error);
    }
  };

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!message.trim() || isChatting || !config) return;

    setIsChatting(true);
    setError(null);
    setStreamingMessage('');
    setStreamingCitations([]);

    // Add user message to chat history
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: message,
    };

    const updatedMessages = [...chatMessages, newUserMessage];
    setChatMessages(updatedMessages);
    setMessage(''); // Clear input field

    // Create data source filters if any data sources are selected
    const attributeFilter =
      selectedDataSources.length > 0 ? createDataSourceFilter(selectedDataSources) : undefined;

    // Get the cognito session ID if available
    const cognitoSessionId = credentialExchangeProxyService.getCognitoSessionId() || undefined;

    try {
      // Get streaming response using chatStream
      const stream = qBusinessProxyChatService.chatStream(config.applicationId, {
        message: newUserMessage.content,
        conversationId: conversationId,
        systemMessageId: systemMessageId,
        attributeFilter: attributeFilter,
        selectedPlugin: selectedPlugin || undefined,
        ...(cognitoSessionId && { sessionId: cognitoSessionId }),
      });

      if (!stream) {
        throw new Error('Failed to initialize chat stream');
      }

      // Process the stream
      const reader = new ReadableStreamDefaultReader(stream);
      const decoder = new TextDecoder();

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Process any remaining data in the buffer
          if (buffer.trim()) {
            processStreamChunk(buffer);
          }
          break;
        }

        // Decode the chunk and add to buffer
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process complete events in the buffer
        const completeEvents = buffer.split('\n\n');

        // Keep the last part which might be incomplete
        buffer = completeEvents.pop() || '';

        // Process complete events
        if (completeEvents.length > 0) {
          processStreamChunk(completeEvents.join('\n\n') + '\n\n');
        }
      }
    } catch (error) {
      console.error('Chat stream error:', error);
      setChatMessages([
        ...updatedMessages,
        {
          role: 'assistant',
          content: 'Sorry, there was an error processing your message. Please try again.',
        },
      ]);
      setError(
        'Failed to process chat message. Please check your AWS credentials and permissions.',
      );
      setIsChatting(false);
    }
  };

  // Handle Enter key press in chat input
  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  // Auto-scroll chat to the bottom when new messages are added
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages, isChatting, streamingMessage]);

  // Fetch available QBusiness applications
  useEffect(() => {
    const fetchAvailableApplications = async () => {
      setIsLoadingApplications(true);
      try {
        const result = await qBusinessProxyService.listApplications();
        if (result.success && result.data) {
          // No longer filtering applications based on user-mode
          // Show all applications regardless of identity type
          setApplications(result.data);

          // Check if we need to select the first application by default
          const savedConfig = localStorage.getItem('application-configuration');
          if (!savedConfig && result.data.length > 0) {
            // No saved config, select the first application
            const firstApp = result.data[0];
            const newConfig: QBusinessConfig = {
              type: 'QBUSINESS',
              applicationId: firstApp.applicationId,
              indexId: firstApp.indexId || '',
              retrieverId: firstApp.retrieverId || '',
              dataSourceId: '',
              syncJobExecutionId: '',
            };

            // Update state and localStorage
            setConfig(newConfig);
            localStorage.setItem('application-configuration', JSON.stringify(newConfig));

            // Fetch data sources and plugins for the selected application
            fetchDataForApplication(firstApp);
          }
        }
      } catch (error) {
        console.error('Error fetching applications:', error);
      } finally {
        setIsLoadingApplications(false);
      }
    };

    fetchAvailableApplications();
  }, []);

  useEffect(() => {
    const fetchApplicationsAndData = async () => {
      try {
        setLoading(true);

        // Get the config from local storage
        const savedConfig = localStorage.getItem('application-configuration');
        let configData: Config | null = null;

        if (savedConfig) {
          try {
            configData = JSON.parse(savedConfig);
            setConfig(configData);
          } catch (error) {
            console.error('Failed to parse saved config:', error);
          }
        }

        if (configData) {
          // Use the application ID from the config
          const applicationId = configData.applicationId;
          const indexId = configData.indexId;
          // Fetch data sources for the configured index and application using QBusinessProxyService
          const sourcesResponse = await qBusinessProxyService.listDataSources(
            applicationId,
            indexId,
          );
          const sources =
            sourcesResponse.success && sourcesResponse.data ? sourcesResponse.data : [];
          setDataSources(sources);

          // Initialize all data sources as selected by default
          setSelectedDataSources(sources.map((source) => source.id));

          // Fetch plugins for the configured application using QBusinessProxyService
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
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please check your AWS credentials and permissions.');
      } finally {
        setLoading(false);
      }
    };

    fetchApplicationsAndData();
  }, []);

  // Fetch data for a specific application
  const fetchDataForApplication = async (selectedApp: Application) => {
    setLoading(true);
    try {
      // Fetch data sources
      const sourcesResponse = await qBusinessProxyService.listDataSources(
        selectedApp.applicationId,
        selectedApp.indexId || '',
      );
      const sources = sourcesResponse.success && sourcesResponse.data ? sourcesResponse.data : [];
      setDataSources(sources);
      setSelectedDataSources(sources.map((source) => source.id));

      // Fetch plugins
      const pluginsResponse = await qBusinessProxyService.listPlugins(selectedApp.applicationId);
      const pluginsData =
        pluginsResponse.success && pluginsResponse.data ? pluginsResponse.data : [];
      const formattedPlugins = pluginsData.map((plugin, index) => {
        const iconColors = ['purple', 'blue', 'green', 'orange', 'red'];
        const colorIndex = index % iconColors.length;

        return {
          id: plugin.id,
          name: plugin.name,
          enabled: true,
          icon: iconColors[colorIndex],
        };
      });
      setPlugins(formattedPlugins);
    } catch (err) {
      console.error('Error fetching data for application:', err);
      setError('Failed to load data for the selected application.');
    } finally {
      setLoading(false);
    }
  };

  // Handle application change
  const handleApplicationChange = (applicationId: string) => {
    // Find the selected application
    const selectedApp = applications.find((app) => app.applicationId === applicationId);
    if (!selectedApp) return;

    // Create new configuration based on the selected application
    const newConfig: QBusinessConfig = {
      type: 'QBUSINESS',
      applicationId: selectedApp.applicationId,
      indexId: selectedApp.indexId || '',
      retrieverId: selectedApp.retrieverId || '',
      dataSourceId: '',
      syncJobExecutionId: '',
    };

    // Update state and localStorage
    setConfig(newConfig);
    localStorage.setItem('application-configuration', JSON.stringify(newConfig));

    // Reset chat state
    setChatMessages([]);
    setConversationId(undefined);
    setSystemMessageId(undefined);

    // Fetch data for the new application
    fetchDataForApplication(selectedApp);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 backdrop-blur-lg bg-gray-900/50 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center relative">
          {/* Left section with padding for "Back to Tools" button */}
          <div className="flex items-center">
            {/* Space for the "Back to Tools" button */}
            <div className="w-36"></div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent ml-4">
              AI Chat Bot
            </h1>
          </div>
          <div className="flex items-center gap-4 z-10 mr-28">
            {' '}
            {/* Add margin to the right to make space for Sign Out button */}
            {/* Application Selector */}
            {applications.length > 0 && (
              <div className="relative">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Application:</span>
                  <div className="relative">
                    <select
                      value={config ? config.applicationId : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleApplicationChange(e.target.value);
                        }
                      }}
                      className="appearance-none bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={loading || isLoadingApplications}
                    >
                      <option value="">Select Application</option>
                      {isLoadingApplications ? (
                        <option disabled>Loading applications...</option>
                      ) : (
                        applications.map((app) => (
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
            <button
              onClick={handleStartNewSession}
              className="flex items-center px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
              title="Start New Session"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              <span>New Session</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-64 border-r border-gray-800 bg-gray-900/30 p-4 hidden md:block">
          {/* Data Sources Section */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-400 mb-2">DATA SOURCES</h2>
            {loading ? (
              <div className="flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-500"></div>
              </div>
            ) : error ? (
              <div className="text-red-400 text-sm p-2">{error}</div>
            ) : (
              <div className="space-y-2">
                {dataSources.length > 0 ? (
                  dataSources.map((source) => (
                    <div
                      key={source.id}
                      className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg"
                    >
                      <div className="flex items-center">
                        <Database className="h-4 w-4 text-purple-400 mr-2" />
                        <span className="text-sm">{source.name}</span>
                      </div>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-purple-500"
                        checked={selectedDataSources.includes(source.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            // When a data source is selected, deselect any selected plugin
                            setSelectedPlugin(null);
                            setSelectedDataSources((prev) => [...prev, source.id]);
                          } else {
                            setSelectedDataSources((prev) => prev.filter((id) => id !== source.id));
                          }
                        }}
                      />
                    </div>
                  ))
                ) : (
                  <div className="text-gray-400 text-sm p-2">No data sources found</div>
                )}
              </div>
            )}
          </div>

          {/* Plugins Section */}
          <div>
            <h2 className="text-sm font-semibold text-gray-400 mb-2">PLUGINS</h2>
            {loading ? (
              <div className="flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-500"></div>
              </div>
            ) : error ? (
              <div className="text-red-400 text-sm p-2">{error}</div>
            ) : (
              <div className="space-y-2">
                {plugins.map((plugin) => (
                  <div
                    key={plugin.id}
                    className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg"
                  >
                    <div className="flex items-center">
                      <Puzzle className={`h-4 w-4 text-${plugin.icon}-400 mr-2`} />
                      <span className="text-sm">{plugin.name}</span>
                    </div>
                    <input
                      type="radio"
                      name="plugin"
                      className="h-4 w-4 accent-purple-500"
                      checked={selectedPlugin === plugin.id}
                      onChange={() => {
                        // When a plugin is selected, deselect all data sources
                        setSelectedDataSources([]);
                        setSelectedPlugin(plugin.id);
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 p-6 overflow-y-auto" ref={chatMessagesRef}>
            <div className="max-w-3xl mx-auto">
              {/* Welcome message - only show if no chat messages yet */}
              {chatMessages.length === 0 && !streamingMessage && (
                <>
                  <div className="flex mb-6">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center mr-4 flex-shrink-0">
                      <MessageSquare className="h-4 w-4 text-white" />
                    </div>
                    <div className="bg-gray-900/50 backdrop-blur-lg rounded-2xl p-4 border border-gray-800 max-w-[80%]">
                      <p className="text-gray-300">
                        Hello! I'm your Q Business AI assistant. I can help you with questions about
                        your data sources, troubleshoot issues, or provide insights. What would you
                        like to know today?
                      </p>
                    </div>
                  </div>

                  {/* Placeholder for chat messages */}
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <MessageSquare className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-gray-300 mb-2">
                        Start a Conversation
                      </h3>
                      <p className="text-gray-400 max-w-md">
                        Ask questions about your Q Business data sources or get help with
                        troubleshooting.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* Chat messages */}
              <div className="space-y-6">
                {chatMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center mr-4 flex-shrink-0">
                        <MessageSquare className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] p-4 rounded-xl ${
                        message.role === 'user'
                          ? 'bg-purple-900/30 border border-purple-800 rounded-br-none'
                          : 'bg-gray-900/50 border border-gray-800 rounded-bl-none'
                      }`}
                    >
                      <p className="text-gray-200 whitespace-pre-wrap">{message.content}</p>

                      {/* Show streaming indicator for messages that are still streaming */}
                      {message.role === 'assistant' && message.isStreaming && (
                        <div className="mt-2 flex items-center">
                          <div className="h-2 w-2 bg-purple-400 rounded-full animate-pulse mr-1"></div>
                          <div className="h-2 w-2 bg-purple-400 rounded-full animate-pulse delay-150 mr-1"></div>
                          <div className="h-2 w-2 bg-purple-400 rounded-full animate-pulse delay-300"></div>
                        </div>
                      )}

                      {/* Show citations for assistant messages only */}
                      {message.role === 'assistant' &&
                        message.citations &&
                        message.citations.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-700">
                            <p className="text-xs text-gray-400 mb-2">Sources:</p>
                            <div className="space-y-1">
                              {message.citations.map((citation, citIndex) => (
                                <div key={citIndex}>
                                  <a
                                    href={citation.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300 text-xs flex items-center group"
                                  >
                                    <span className="truncate">{citation.title}</span>
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="12"
                                      height="12"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      className="ml-1 flex-shrink-0 group-hover:text-blue-300 transition-colors"
                                    >
                                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                      <polyline points="15 3 21 3 21 9"></polyline>
                                      <line x1="10" y1="14" x2="21" y2="3"></line>
                                    </svg>
                                  </a>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                ))}

                {/* We no longer need a separate streaming message display since it's now part of chatMessages */}

                {/* Loading indicator when AI is responding but no streaming content yet */}
                {isChatting && !streamingMessage && (
                  <div className="flex justify-start">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center mr-4 flex-shrink-0">
                      <MessageSquare className="h-4 w-4 text-white" />
                    </div>
                    <div className="max-w-[80%] p-4 rounded-xl bg-gray-900/50 border border-gray-800 rounded-bl-none">
                      <div className="flex items-center">
                        <Loader className="h-4 w-4 text-purple-400 animate-spin mr-2" />
                        <span className="text-gray-400">AI is responding...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Input area */}
          <div className="border-t border-gray-800 p-4">
            <div className="max-w-3xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  className="block w-full pl-4 pr-12 py-3 bg-gray-900/50 backdrop-blur-lg border border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white placeholder-gray-400"
                  placeholder="Type your message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isChatting || !config}
                />
                <button
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-purple-400 hover:text-purple-300 disabled:text-gray-600 disabled:cursor-not-allowed"
                  onClick={handleSendMessage}
                  disabled={!message.trim() || isChatting || !config}
                >
                  {isChatting ? (
                    <Loader className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Responses are generated based on selected data sources and may not be 100% accurate.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;
