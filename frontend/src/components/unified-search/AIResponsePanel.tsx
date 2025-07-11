// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Sparkles, Send, ExternalLink, Loader, MessageSquare } from 'lucide-react';
import React, { useRef, useEffect, useState, KeyboardEvent } from 'react';

import { credentialExchangeProxyService } from '../../services/proxy/CredentialExchangeProxyService';
import {
  ChatMessage,
  qBusinessProxyChatService,
  StreamingChatResponse,
} from '../../services/proxy/QBusinessProxyChatService';

interface Citation {
  title: string;
  uri: string;
  snippet?: string;
}

interface AIResponsePanelProps {
  isAiResponseLoading: boolean;
  aiResponse: string | null;
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isChatting: boolean;
  setIsChatting: (isChatting: boolean) => void;
  chatInput: string;
  setChatInput: (input: string) => void;
  toggleChatVisibility: () => void;
  applicationId: string;
  conversationId?: string;
  setConversationId: (id?: string) => void;
  systemMessageId?: string;
  setSystemMessageId: (id?: string) => void;
  setError: (error: string | null) => void;
}

const AIResponsePanel: React.FC<AIResponsePanelProps> = ({
  isAiResponseLoading,
  aiResponse,
  chatMessages,
  setChatMessages,
  isChatting,
  setIsChatting,
  chatInput,
  setChatInput,
  toggleChatVisibility,
  applicationId,
  conversationId,
  setConversationId,
  systemMessageId,
  setSystemMessageId,
  setError,
}) => {
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [streamingCitations, setStreamingCitations] = useState<any[]>([]);

  // Auto-scroll chat to the bottom when new messages are added
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages, isChatting, streamingMessage]);

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
            setChatMessages((prevMessages: ChatMessage[]) => {
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
            setChatMessages((prevMessages: ChatMessage[]) => {
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
          setChatMessages((prevMessages: ChatMessage[]) => {
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
          console.error('Streaming error:', data.message);
          setError(data.message || 'An error occurred during streaming');
          setIsChatting(false);

          // Add error message to chat
          setChatMessages((prev: ChatMessage[]) => [
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

  // Function to handle chat continuation
  const handleChatContinue = async () => {
    if (!chatInput.trim() || isChatting || !applicationId) return;

    setIsChatting(true);
    setError(null);
    setStreamingMessage('');
    setStreamingCitations([]);

    // Add user message to chat history
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: chatInput,
    };

    const updatedMessages = [...chatMessages, newUserMessage];
    setChatMessages(updatedMessages);
    setChatInput(''); // Clear input field

    // Get the cognito session ID if available
    const cognitoSessionId = credentialExchangeProxyService.getCognitoSessionId() || undefined;

    try {
      // Get streaming response using chatStream
      const stream = qBusinessProxyChatService.chatStream(applicationId, {
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
      /*eslint no-constant-condition: "error"*/
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
  const handleChatKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleChatContinue();
    }
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-800 h-full flex flex-col shadow-lg shadow-black/20 overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-purple-400 flex items-center">
          <Sparkles className="h-5 w-5 mr-2" />
          AI Response
        </h2>
        <button
          onClick={toggleChatVisibility}
          className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-800/50 transition-colors"
          title="Minimize chat"
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
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>

      {/* Chat messages */}
      <div
        ref={chatMessagesRef}
        className="space-y-6 mb-6 flex-1 overflow-y-auto"
        style={{ minHeight: '200px' }}
      >
        {isAiResponseLoading && !streamingMessage ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-center">
              <Loader className="h-8 w-8 text-purple-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Generating AI response...</p>
            </div>
          </div>
        ) : (
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
        )}
      </div>

      {/* Chat input */}
      <div className="relative">
        <input
          type="text"
          className="block w-full pl-4 pr-12 py-3 bg-gray-800/50 border border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white placeholder-gray-500"
          placeholder="Continue the conversation..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyPress={handleChatKeyPress}
          disabled={isChatting}
        />
        <button
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-purple-400 hover:text-purple-300 disabled:text-gray-600"
          onClick={handleChatContinue}
          disabled={!chatInput.trim() || isChatting}
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default AIResponsePanel;
