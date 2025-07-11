// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Search, Sparkles, Loader, AlertCircle, GripVertical } from 'lucide-react';
import React, { useRef, useState } from 'react';

import AIResponsePanel from './AIResponsePanel';
import DocumentResultsPanel from './DocumentResultsPanel';
import { ChatMessage } from '../../services/proxy/QBusinessProxyChatService';
import { Config } from '../../types/types';

interface SearchContainerProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isAiResponseLoading: boolean;
  isDocumentsLoading: boolean;
  aiResponse: string | null;
  searchResults: any[];
  handleSearch: () => void;
  handleSearchKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  error: string | null;
  setError: (error: string | null) => void;
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isChatting: boolean;
  setIsChatting: (isChatting: boolean) => void;
  chatInput: string;
  setChatInput: (input: string) => void;
  activeFilters: { name: string; value: string }[];
  setActiveFilters: (filters: { name: string; value: string }[]) => void;
  resultsPerPage: number;
  currentPage: number;
  handleLoadMoreResults: (page: number, pageSize: number) => void;
  nextToken: string | undefined;
  previousTokens: string[];
  hasSearched: boolean;
  config: Config | null;
  conversationId?: string;
  setConversationId: (id?: string) => void;
  systemMessageId?: string;
  setSystemMessageId: (id?: string) => void;
}

const SearchContainer: React.FC<SearchContainerProps> = ({
  searchQuery,
  setSearchQuery,
  isAiResponseLoading,
  isDocumentsLoading,
  aiResponse,
  searchResults,
  handleSearch,
  handleSearchKeyPress,
  error,
  setError,
  chatMessages,
  setChatMessages,
  isChatting,
  setIsChatting,
  chatInput,
  setChatInput,
  activeFilters,
  setActiveFilters,
  resultsPerPage,
  currentPage,
  handleLoadMoreResults,
  nextToken,
  previousTokens,
  hasSearched,
  config,
  conversationId,
  setConversationId,
  systemMessageId,
  setSystemMessageId,
}) => {
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(35); // percentage
  const resizeDividerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleChatVisibility = () => {
    setIsChatMinimized(!isChatMinimized);
  };

  // Handle mouse down on the resize divider
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  // Handle mouse move for resizing
  React.useEffect(() => {
    const handleResize = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const mouseX = e.clientX - containerRect.left;

      // Calculate percentage (constrain between 25% and 60%)
      let newLeftPanelWidth = (mouseX / containerWidth) * 100;
      newLeftPanelWidth = Math.max(25, Math.min(60, newLeftPanelWidth));

      setLeftPanelWidth(newLeftPanelWidth);
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleResize);
      document.addEventListener('mouseup', handleResizeEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing]);

  return (
    <div className="w-full px-4 py-8 flex-1 overflow-hidden">
      {/* Search input */}
      <div className="max-w-3xl mx-auto mb-8">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-12 pr-12 py-4 bg-gray-900/50 backdrop-blur-lg border border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white placeholder-gray-400"
            placeholder="Search for anything..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleSearchKeyPress}
            disabled={isAiResponseLoading || isDocumentsLoading}
          />
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
            {isAiResponseLoading || isDocumentsLoading ? (
              <Loader className="h-5 w-5 text-purple-400 animate-spin" />
            ) : (
              <button
                onClick={handleSearch}
                className="flex items-center gap-2 text-purple-400 bg-gray-800/50 px-3 py-1 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                <span className="text-sm">Search</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="max-w-3xl mx-auto mb-6">
          <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4 flex items-start">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-red-400 font-medium">Error</h3>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Results area */}
      {isAiResponseLoading || isDocumentsLoading || aiResponse || hasSearched ? (
        <div className="w-full mx-auto h-[calc(100vh-200px)]">
          <div
            ref={containerRef}
            className={`flex flex-col md:flex-row relative transition-all duration-300 h-full ${isChatMinimized ? 'md:ml-12' : ''}`}
            style={{ cursor: isResizing ? 'col-resize' : 'default' }}
          >
            {/* AI Response and Chat */}
            {!isChatMinimized && (
              <div className="flex-shrink-0 relative" style={{ width: `${leftPanelWidth}%` }}>
                <AIResponsePanel
                  isAiResponseLoading={isAiResponseLoading}
                  aiResponse={aiResponse}
                  chatMessages={chatMessages}
                  setChatMessages={setChatMessages}
                  isChatting={isChatting}
                  setIsChatting={setIsChatting}
                  chatInput={chatInput}
                  setChatInput={setChatInput}
                  toggleChatVisibility={toggleChatVisibility}
                  applicationId={config?.applicationId || ''}
                  conversationId={conversationId}
                  setConversationId={setConversationId}
                  systemMessageId={systemMessageId}
                  setSystemMessageId={setSystemMessageId}
                  setError={setError}
                />
              </div>
            )}

            {/* Resizable divider */}
            {!isChatMinimized && (
              <div
                ref={resizeDividerRef}
                className="hidden md:flex absolute top-0 bottom-0 z-10 cursor-col-resize items-center justify-center hover:bg-gray-800/20 transition-colors"
                style={{
                  left: `calc(${leftPanelWidth}% - 6px)`,
                  width: '12px',
                  touchAction: 'none',
                }}
                onMouseDown={handleResizeStart}
              >
                <div
                  className={`h-24 w-1 ${isResizing ? 'bg-purple-500' : 'bg-gray-700'} rounded-full transition-colors`}
                ></div>
                <GripVertical
                  className={`absolute ${isResizing ? 'text-purple-400' : 'text-gray-500'} ${isResizing ? 'opacity-100' : 'opacity-50'} transition-all`}
                  size={16}
                />
              </div>
            )}

            {/* Relevant Documents */}
            <div
              className={`transition-all duration-300 ${isChatMinimized ? 'w-full' : ''} ${!isChatMinimized ? 'ml-4' : ''}`}
              style={{
                width: isChatMinimized ? '100%' : `calc(${100 - leftPanelWidth}% - 16px)`,
              }}
            >
              <DocumentResultsPanel
                isDocumentsLoading={isDocumentsLoading}
                searchResults={searchResults}
                activeFilters={activeFilters}
                setActiveFilters={setActiveFilters}
                resultsPerPage={resultsPerPage}
                currentPage={currentPage}
                handleLoadMoreResults={handleLoadMoreResults}
                nextToken={nextToken}
                previousTokens={previousTokens}
                toggleChatVisibility={toggleChatVisibility}
                isChatMinimized={isChatMinimized}
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Placeholder content when no search has been performed */}
          <div className="max-w-3xl mx-auto">
            <div className="bg-gray-900/50 backdrop-blur-lg rounded-2xl p-8 border border-gray-800">
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Search className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-300 mb-2">
                    Search with AI Assistance!
                  </h3>
                  <p className="text-gray-400 max-w-md">
                    Enter a search query above to find content with the help of our Generative AI
                    assistant.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Features section */}
          <div className="mt-16">
            <h2 className="text-xl font-semibold text-center mb-8 text-gray-300">
              Unified Search Features
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-gray-900/30 backdrop-blur-sm p-6 rounded-xl border border-gray-800">
                <h3 className="font-medium mb-2 text-purple-400">AI Assistance</h3>
                <p className="text-gray-400 text-sm">
                  Get AI-powered responses and insights based on your query.
                </p>
              </div>
              <div className="bg-gray-900/30 backdrop-blur-sm p-6 rounded-xl border border-gray-800">
                <h3 className="font-medium mb-2 text-blue-400">Document Search</h3>
                <p className="text-gray-400 text-sm">
                  Find relevant documents and resources related to your search query.
                </p>
              </div>
              <div className="bg-gray-900/30 backdrop-blur-sm p-6 rounded-xl border border-gray-800">
                <h3 className="font-medium mb-2 text-green-400">Interactive Chat</h3>
                <p className="text-gray-400 text-sm">
                  Continue the conversation to get more specific information.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SearchContainer;
