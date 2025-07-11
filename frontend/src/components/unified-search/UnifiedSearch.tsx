// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Unified Search Component
 *
 * This is the consolidated version of the UnifiedSearch component.
 * The duplicate version in /src/components/UnifiedSearch.tsx
 * has been removed to avoid code duplication.
 *
 * This component provides a comprehensive search interface with:
 * - AI-powered responses to search queries
 * - Document search with filtering capabilities
 * - Interactive chat functionality
 * - Application selection for different data sources
 */
import React, { useState, useEffect, KeyboardEvent } from 'react';

import { credentialExchangeProxyService } from '../../services/proxy/CredentialExchangeProxyService';
import {
  qBusinessProxyService,
  SearchResult,
  Application,
} from '../../services/proxy/QBusinessProxyService';
import {
  qBusinessProxyChatService,
  ChatMessage,
  StreamingChatResponse,
} from '../../services/proxy/QBusinessProxyChatService';
import { Config, QBusinessConfig } from '../../types/types';

// Import our new components
import Header from './Header';
import SearchContainer from './SearchContainer';

interface Citation {
  title: string;
  uri: string;
  snippet?: string;
}

const UnifiedSearch: React.FC = () => {
  // State variables
  const [searchQuery, setSearchQuery] = useState('');
  const [isAiResponseLoading, setIsAiResponseLoading] = useState(false);
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [nextToken, setNextToken] = useState<string | undefined>(undefined);
  const [previousTokens, setPreviousTokens] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(20); // Default to 20 results per page
  const [totalResults, setTotalResults] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [systemMessageId, setSystemMessageId] = useState<string | undefined>(undefined);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [streamingCitations, setStreamingCitations] = useState<any[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<{ name: string; value: string }[]>([]);
  const [availableApplications, setAvailableApplications] = useState<Application[]>([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // Load the QBusiness configuration from localStorage if available
  useEffect(() => {
    const savedConfig = localStorage.getItem('application-configuration');
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        setConfig(parsedConfig);
      } catch (error) {
        console.error('Failed to parse saved config:', error);
        // Don't set error, allow user to select configuration in the UI
      }
    }
    // No error if no configuration found - user can select in the UI
  }, []);

  // Fetch available QBusiness applications
  useEffect(() => {
    const fetchAvailableApplications = async () => {
      setIsLoadingApplications(true);
      try {
        const result = await qBusinessProxyService.listApplications();
        if (result.success && result.data) {
          // No longer filtering applications based on user-mode
          // Show all applications regardless of identity type
          setAvailableApplications(result.data);

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

            // Clear previous search results and chat
            setSearchResults([]);
            setChatMessages([]);
            setAiResponse(null);
            setConversationId(undefined);
            setSystemMessageId(undefined);
            setCitations([]);
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

  // Handle application change
  const handleApplicationChange = (applicationId: string) => {
    // Find the selected application
    const selectedApp = availableApplications.find((app) => app.applicationId === applicationId);
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

    // Clear previous search results and chat
    setSearchResults([]);
    setChatMessages([]);
    setAiResponse(null);
    setConversationId(undefined);
    setSystemMessageId(undefined);
    setCitations([]);
  };

  // Process a streaming response chunk
  const processStreamChunk = (chunk: string) => {
    try {
      console.log('Processing stream chunk:', chunk);
      // Split the chunk by newlines to handle multiple events
      const events = chunk.split('\n\n').filter((event) => event.trim().startsWith('data: '));
      console.log('Found events:', events.length);

      // Ensure hasSearched is set to true whenever we process any message
      setHasSearched(true);

      for (const event of events) {
        // Extract the JSON data from the event
        const jsonStr = event.replace('data: ', '');
        const data: StreamingChatResponse = JSON.parse(jsonStr);
        console.log('Parsed event data:', data);

        // Process different event types
        if (data.type === 'text' && data.content) {
          // Append text content to the streaming message
          setStreamingMessage((prev) => {
            const updatedMessage = prev + data.content;

            // Also update the aiResponse state to ensure it's displayed in the UI
            setAiResponse(updatedMessage);

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
          console.log('Received complete event');

          // Capture the final message content and citations before resetting
          const finalMessage = streamingMessage;
          const finalCitations = [...streamingCitations];

          // Mark the streaming message as complete in the chat history
          setChatMessages((prevMessages) => {
            console.log('Updating chat messages on complete');
            const newMessages = [...prevMessages];
            // Find the streaming message
            const streamingIndex = newMessages.findIndex(
              (msg) => msg.role === 'assistant' && msg.isStreaming === true,
            );

            if (streamingIndex >= 0) {
              // Update the message to mark it as no longer streaming
              newMessages[streamingIndex] = {
                ...newMessages[streamingIndex],
                content: finalMessage, // Ensure we use the final message content
                citations: finalCitations.length > 0 ? finalCitations : undefined,
                isStreaming: false,
              };
            } else {
              // If no streaming message was found, add the final message
              newMessages.push({
                role: 'assistant',
                content: finalMessage,
                citations: finalCitations.length > 0 ? finalCitations : undefined,
                isStreaming: false,
              });
            }
            return newMessages;
          });

          // Update conversation and system message IDs if available
          if (data.conversationId) {
            setConversationId(data.conversationId);
          }
          if (data.systemMessageId) {
            setSystemMessageId(data.systemMessageId);
          }

          // Preserve the final message in aiResponse
          setAiResponse(finalMessage);

          // Delay resetting streaming state to ensure UI updates first
          // Increased timeout to 500ms to give UI more time to update
          setTimeout(() => {
            console.log('Resetting streaming state after delay');
            // Only set isChatting to false, but keep the message content and citations
            // This ensures the message and Relevant Documents section remain visible
            setIsChatting(false);

            // Force a re-render of the UI to ensure everything is displayed properly
            setAiResponse(finalMessage);
          }, 500);
        } else if (data.type === 'error') {
          // Handle error
          console.error('Streaming error:', data.message);
          setError(data.message || 'An error occurred during streaming');
          setIsChatting(false);

          // Add error message to chat
          setChatMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: 'Sorry, there was an error processing your message. Please try again.',
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

  // Function to handle search
  const handleSearch = async () => {
    if (!searchQuery.trim() || isAiResponseLoading || isDocumentsLoading || !config) return;
    // Ensure we have a QBusiness configuration
    if (config.type !== 'QBUSINESS') {
      setError('Invalid configuration type. QBusiness configuration required.');
      return;
    }

    const qbConfig = config as QBusinessConfig;

    setIsAiResponseLoading(true);
    setIsDocumentsLoading(true);
    setAiResponse(null);
    setSearchResults([]);
    setChatMessages([]);
    setConversationId(undefined);
    setCitations([]);
    setError(null);
    setActiveFilters([]); // Clear any active filters when starting a new search
    setHasSearched(true); // Mark that a search has been performed

    // Create initial user message
    const initialMessage: ChatMessage = {
      role: 'user',
      content: searchQuery,
    };

    // Get the cognito session ID if available
    const cognitoSessionId = credentialExchangeProxyService.getCognitoSessionId() || undefined;

    // Add user message to chat history
    setChatMessages([initialMessage]);

    // Reset streaming state
    setStreamingMessage('');
    setStreamingCitations([]);

    // Start both AI response streaming and document search concurrently
    // We'll use Promise.all to track both operations but not wait for both to complete

    // 1. Start the AI response streaming in a separate async function
    const startAiResponseStreaming = async () => {
      try {
        // Get streaming response using chatStream
        const stream = qBusinessProxyChatService.chatStream(qbConfig.applicationId, {
          message: initialMessage.content,
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
            const eventsString = completeEvents.join('\n\n') + '\n\n';
            processStreamChunk(eventsString);

            // Force a re-render by directly setting aiResponse with the current streaming message
            setAiResponse((prev) => streamingMessage);
          }
        }

        // Set AI response for display in the UI
        setAiResponse(streamingMessage);
      } catch (error) {
        console.error('AI response error:', error);
        setAiResponse('Sorry, there was an error processing your search. Please try again.');
        setError('Failed to get AI response. Please check your AWS credentials and permissions.');
      } finally {
        setIsAiResponseLoading(false);
      }
    };

    // 2. Start the document search in a separate async function
    const startDocumentSearch = async () => {
      try {
        const response = await qBusinessProxyService.searchRelevantContent(
          qbConfig.applicationId,
          qbConfig.retrieverId,
          searchQuery,
          resultsPerPage,
          undefined,
          cognitoSessionId,
        );

        if (!response.success || !response.data) {
          throw new Error('Failed to get search results');
        }

        // Update state with search results as soon as they're available
        setSearchResults(response.data.results);
        setNextToken(response.data.nextToken);
        setPreviousTokens([]); // Reset previous tokens on new search
        setTotalResults(response.data.results.length);
        setCurrentPage(1);
      } catch (error) {
        console.error('Document search error:', error);
        setError(
          'Failed to retrieve relevant documents. Please check your AWS credentials and permissions.',
        );
      } finally {
        setIsDocumentsLoading(false);
      }
    };

    // Start both operations concurrently without waiting for both to complete
    startAiResponseStreaming();
    startDocumentSearch();
  };

  // Function to handle chat continuation
  const handleChatContinue = async () => {
    if (!chatInput.trim() || isChatting || !conversationId || !config) return;
    console.log('handling chat continue');
    // Ensure we have a QBusiness configuration
    if (config.type !== 'QBUSINESS') {
      setError('Invalid configuration type. QBusiness configuration required.');
      return;
    }

    const qbConfig = config as QBusinessConfig;

    // Set chatting state to true to show loading indicator
    setIsChatting(true);
    setError(null);
    setHasSearched(true); // Ensure results area stays visible
    console.log('Starting chat streaming...');

    try {
      // Add user message to chat history
      const newUserMessage: ChatMessage = {
        role: 'user',
        content: chatInput,
      };

      const updatedMessages = [...chatMessages, newUserMessage];
      setChatMessages(updatedMessages);
      setChatInput('');

      // Reset streaming state
      setStreamingMessage('');
      setStreamingCitations([]);

      // Get the cognito session ID if available
      const cognitoSessionId = credentialExchangeProxyService.getCognitoSessionId() || undefined;

      // Get streaming response using chatStream
      const stream = qBusinessProxyChatService.chatStream(qbConfig.applicationId, {
        message: newUserMessage.content,
        conversationId: conversationId,
        systemMessageId: systemMessageId,
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
          const eventsString = completeEvents.join('\n\n') + '\n\n';
          console.log('Processing events in handleChatContinue:', eventsString);
          processStreamChunk(eventsString);

          // Force a re-render by directly setting aiResponse with the current streaming message
          // This ensures the UI updates even if React batches state updates
          setAiResponse((prev) => {
            console.log('Current aiResponse in handleChatContinue:', prev);
            console.log('Current streamingMessage in handleChatContinue:', streamingMessage);
            return streamingMessage;
          });
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages([
        ...chatMessages,
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

  // Handle Enter key press in search input
  const handleSearchKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Handle Enter key press in chat input
  const handleChatKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleChatContinue();
    }
  };

  // Function to load more results or change page
  const handleLoadMoreResults = async (page: number, pageSize: number) => {
    if (!config) return;

    // Ensure we have a QBusiness configuration
    if (config.type !== 'QBUSINESS') {
      setError('Invalid configuration type. QBusiness configuration required.');
      return;
    }

    const qbConfig = config as QBusinessConfig;
    setIsDocumentsLoading(true);

    try {
      console.log('next token', nextToken);
      // Determine if we're going forward or backward
      const goingForward = page > currentPage;
      let tokenToUse: string | undefined = undefined;

      if (goingForward) {
        // Going to next page, use the nextToken
        tokenToUse = nextToken;
      } else if (previousTokens.length > 0) {
        // Going to previous page, use the appropriate previous token
        // We need the token that was used to get to the page before the current one
        const tokenIndex = previousTokens.length - 1;
        tokenToUse = previousTokens[tokenIndex];

        // Remove the token we're about to use from the previousTokens array
        const newPreviousTokens = [...previousTokens];
        newPreviousTokens.pop();
        setPreviousTokens(newPreviousTokens);
      }

      // Get the cognito session ID if available
      const cognitoSessionId = credentialExchangeProxyService.getCognitoSessionId() || undefined;

      const response = await qBusinessProxyService.searchRelevantContent(
        qbConfig.applicationId,
        qbConfig.retrieverId,
        searchQuery,
        pageSize,
        tokenToUse,
        cognitoSessionId,
      );

      if (!response.success || !response.data) {
        throw new Error('Failed to get search results');
      }

      // If going forward, save the current token to previousTokens
      if (goingForward && nextToken) {
        setPreviousTokens([...previousTokens, nextToken]);
      }

      setSearchResults(response.data.results);
      setNextToken(response.data.nextToken);
      setCurrentPage(page);
      setResultsPerPage(pageSize);
    } catch (error) {
      console.error('Document search error:', error);
      setError(
        'Failed to retrieve more documents. Please check your AWS credentials and permissions.',
      );
    } finally {
      setIsDocumentsLoading(false);
    }
  };

  // Debug effect to log state changes
  useEffect(() => {
    console.log('streamingMessage changed:', streamingMessage);
    console.log('chatMessages:', chatMessages);
    console.log('isAiResponseLoading:', isAiResponseLoading);
    console.log('isChatting:', isChatting);

    // Force UI update when streamingMessage changes
    if (streamingMessage) {
      // Make sure we have a streaming message in the chat history
      const hasStreamingMessage = chatMessages.some((msg) => msg.isStreaming);
      if (!hasStreamingMessage) {
        console.log('Adding streaming message to chat history');
        setChatMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: streamingMessage,
            isStreaming: true,
            citations: streamingCitations.length > 0 ? [...streamingCitations] : undefined,
          },
        ]);
      }
    }
  }, [streamingMessage, chatMessages, streamingCitations]);

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      {/* Header Component */}
      <Header
        availableApplications={availableApplications}
        config={config}
        isAiResponseLoading={isAiResponseLoading}
        isDocumentsLoading={isDocumentsLoading}
        isLoadingApplications={isLoadingApplications}
        handleApplicationChange={handleApplicationChange}
      />

      {/* Search Container Component */}
      <SearchContainer
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isAiResponseLoading={isAiResponseLoading}
        isDocumentsLoading={isDocumentsLoading}
        aiResponse={aiResponse}
        searchResults={searchResults}
        handleSearch={handleSearch}
        handleSearchKeyPress={handleSearchKeyPress}
        error={error}
        setError={setError}
        chatMessages={chatMessages}
        setChatMessages={setChatMessages}
        isChatting={isChatting}
        setIsChatting={setIsChatting}
        chatInput={chatInput}
        setChatInput={setChatInput}
        activeFilters={activeFilters}
        setActiveFilters={setActiveFilters}
        resultsPerPage={resultsPerPage}
        currentPage={currentPage}
        handleLoadMoreResults={handleLoadMoreResults}
        nextToken={nextToken}
        previousTokens={previousTokens}
        hasSearched={hasSearched}
        config={config}
        conversationId={conversationId}
        setConversationId={setConversationId}
        systemMessageId={systemMessageId}
        setSystemMessageId={setSystemMessageId}
      />
    </div>
  );
};

export default UnifiedSearch;
