// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { FileText, ExternalLink, Loader, Filter, X } from 'lucide-react';
import React from 'react';

import { SearchResult } from '../../services/proxy/QBusinessProxyService';

interface DocumentResultsPanelProps {
  isDocumentsLoading: boolean;
  searchResults: SearchResult[];
  activeFilters: { name: string; value: string }[];
  setActiveFilters: (filters: { name: string; value: string }[]) => void;
  resultsPerPage: number;
  currentPage: number;
  handleLoadMoreResults: (page: number, pageSize: number) => void;
  nextToken: string | undefined;
  previousTokens: string[];
  toggleChatVisibility: () => void;
  isChatMinimized: boolean;
}

const DocumentResultsPanel: React.FC<DocumentResultsPanelProps> = ({
  isDocumentsLoading,
  searchResults,
  activeFilters,
  setActiveFilters,
  resultsPerPage,
  currentPage,
  handleLoadMoreResults,
  nextToken,
  previousTokens,
  toggleChatVisibility,
  isChatMinimized,
}) => {
  return (
    <div className="bg-gray-900/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-800 h-full flex flex-col shadow-lg shadow-black/20 overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-blue-400 flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          Relevant Documents
        </h2>
        {isChatMinimized && (
          <button
            onClick={toggleChatVisibility}
            className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-800/50 transition-colors"
            title="Show chat"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        )}
      </div>

      {/* Filter bar */}
      {activeFilters.length > 0 && (
        <div className="mb-4 bg-gray-800/50 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center mb-2">
            <Filter className="h-3 w-3 text-blue-400 mr-1" />
            <span className="text-xs text-blue-400">Active Filters:</span>
            <button
              className="ml-auto text-xs text-gray-400 hover:text-gray-300"
              onClick={() => setActiveFilters([])}
            >
              Clear All
            </button>
          </div>
          <div className="flex flex-wrap gap-2 py-1">
            {activeFilters.map((filter, index) => (
              <div
                key={index}
                className="inline-flex items-center bg-blue-900/30 border border-blue-800/50 rounded px-2 py-1 text-xs"
              >
                <span className="text-blue-300 font-medium mr-1">{filter.name}:</span>
                <span className="text-gray-300">{filter.value}</span>
                <button
                  className="ml-1 text-gray-400 hover:text-gray-300"
                  onClick={() => {
                    const newFilters = [...activeFilters];
                    newFilters.splice(index, 1);
                    setActiveFilters(newFilters);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isDocumentsLoading ? (
        <div className="flex justify-center items-center h-full">
          <div className="text-center">
            <Loader className="h-8 w-8 text-blue-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Finding relevant documents...</p>
          </div>
        </div>
      ) : searchResults.length > 0 ? (
        <div className="flex flex-col h-full overflow-visible">
          {/* Results per page selector */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center">
              <span className="text-sm text-gray-400 mr-2">Results per page:</span>
              <select
                className="bg-gray-800 border border-gray-700 text-white rounded-md text-sm px-2 py-1"
                value={resultsPerPage}
                onChange={(e) => handleLoadMoreResults(1, parseInt(e.target.value))}
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
              </select>
            </div>
            <div className="text-sm text-gray-400">Page {currentPage}</div>
          </div>

          <div className="space-y-6 overflow-y-auto pr-2 flex-1" style={{ minHeight: '200px' }}>
            {(() => {
              // Filter the results based on active filters
              const filteredResults = searchResults.filter((result) => {
                // If no filters are active, show all results
                if (activeFilters.length === 0) return true;

                // Check if the result matches all active filters
                return activeFilters.every((filter) => {
                  // Find attributes that match the filter name
                  const matchingAttrs =
                    result.documentAttributes?.filter((attr) => attr.name === filter.name) || [];

                  // Check if any of the matching attributes have the filter value
                  return matchingAttrs.some((attr) => {
                    const attrValue =
                      attr.value?.stringValue ||
                      attr.value?.longValue?.toString() ||
                      attr.value?.dateValue?.toString() ||
                      (attr.value ? JSON.stringify(attr.value) : 'N/A');

                    return attrValue === filter.value;
                  });
                });
              });

              // If there are no filtered results, show a message
              if (filteredResults.length === 0) {
                return (
                  <div className="text-center py-8">
                    <Filter className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500">No documents match the selected filters</p>
                    <button
                      className="mt-2 text-blue-400 text-sm hover:text-blue-300"
                      onClick={() => setActiveFilters([])}
                    >
                      Clear all filters
                    </button>
                  </div>
                );
              }

              // Return the filtered results
              return filteredResults.map((result, index) => (
                <div
                  key={index}
                  className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 hover:border-blue-500/30 hover:bg-gray-800/70 transition-all shadow-md shadow-black/10 hover:shadow-lg hover:shadow-blue-900/10"
                >
                  <a
                    href={result.documentUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 font-medium flex items-center text-lg mb-1 group"
                  >
                    <span className="truncate max-w-full break-words">{result.documentTitle}</span>
                    <ExternalLink className="h-3 w-3 ml-1 flex-shrink-0 group-hover:text-blue-300 transition-colors" />
                  </a>
                  <p className="text-green-400/60 text-xs mb-2 flex items-center opacity-70 overflow-hidden">
                    <span className="truncate max-w-full break-words">{result.documentUri}</span>
                  </p>
                  {result.documentExcerpt && (
                    <p className="text-gray-300 text-sm mt-2 leading-relaxed break-words overflow-hidden">
                      {result.documentExcerpt}
                    </p>
                  )}
                  {result.documentAttributes && result.documentAttributes.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-700">
                      <p className="text-xs text-gray-400 mb-1">Document Attributes:</p>
                      <div className="flex flex-wrap gap-1 overflow-hidden">
                        {result.documentAttributes
                          .filter(
                            (attr) =>
                              attr.name !== '_data_source_id' && attr.name !== '_source_uri',
                          )
                          .map((attr, attrIndex) => (
                            <button
                              key={attrIndex}
                              className="inline-flex items-center bg-gray-800/70 rounded px-1.5 py-0.5 text-[10px] hover:bg-gray-700 cursor-pointer transition-colors"
                              onClick={() => {
                                // Add this attribute as a filter
                                const value =
                                  attr.value?.stringValue ||
                                  attr.value?.longValue?.toString() ||
                                  attr.value?.dateValue?.toString() ||
                                  (attr.value ? JSON.stringify(attr.value) : 'N/A');

                                // Check if this filter is already active
                                const filterExists = activeFilters.some(
                                  (filter) => filter.name === attr.name && filter.value === value,
                                );

                                if (!filterExists) {
                                  setActiveFilters([
                                    ...activeFilters,
                                    {
                                      name: attr.name || '',
                                      value: value,
                                    },
                                  ]);
                                }
                              }}
                            >
                              <span className="text-gray-300 max-w-[150px] truncate overflow-hidden">
                                {attr.value?.stringValue ||
                                  attr.value?.longValue ||
                                  attr.value?.dateValue?.toString() ||
                                  (attr.value ? JSON.stringify(attr.value) : 'N/A')}
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                  {result.score !== undefined && (
                    <div className="mt-3 flex items-center">
                      <div className="h-1.5 bg-gray-700/50 rounded-full w-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, result.score * 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-blue-400 font-medium ml-2">
                        {Math.round((result.score || 0) * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              ));
            })()}
          </div>

          {/* Pagination controls */}
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-800 sticky bottom-0 bg-gray-900/80 backdrop-blur-sm z-10">
            <button
              className="px-3 py-1 bg-gray-800 text-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
              onClick={() => handleLoadMoreResults(currentPage - 1, resultsPerPage)}
              disabled={previousTokens.length === 0 || isDocumentsLoading}
            >
              Previous
            </button>
            <button
              className="px-3 py-1 bg-gray-800 text-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
              onClick={() => handleLoadMoreResults(currentPage + 1, resultsPerPage)}
              disabled={!nextToken || isDocumentsLoading}
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <FileText className="h-8 w-8 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500">No relevant documents found</p>
        </div>
      )}
    </div>
  );
};

export default DocumentResultsPanel;
