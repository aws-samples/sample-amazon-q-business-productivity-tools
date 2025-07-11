// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Database, Search, MessageSquare, CheckSquare } from 'lucide-react';
import React from 'react';

interface ToolsLandingPageProps {
  onSelectTool: (tool: string) => void;
}

interface ToolCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  isNew?: boolean;
  badge?: string;
}

const ToolCard: React.FC<ToolCardProps> = ({ icon, title, description, onClick, isNew, badge }) => {
  return (
    <div
      onClick={onClick}
      className="bg-gray-900/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-800 hover:border-purple-500/50 transition-all duration-300 hover:transform hover:scale-105 cursor-pointer relative"
    >
      {isNew && (
        <span className="absolute -top-2 -right-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs px-2 py-1 rounded-full">
          NEW
        </span>
      )}
      {badge && (
        <span className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
          {badge}
        </span>
      )}
      <div className="text-purple-400 mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
};

const ToolsLandingPage: React.FC<ToolsLandingPageProps> = ({ onSelectTool }) => {
  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Header */}
      <div className="bg-gray-900 shadow-md">
        <div className="container mx-auto px-6 py-3 flex justify-between items-center">
          <div className="text-xl font-bold">Q Business Tools</div>
        </div>
      </div>

      <div className="relative">
        {/* Animated gradient background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20"></div>
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/10 via-transparent to-purple-900/10 animate-pulse"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 container mx-auto px-6 py-20">
          {/* Hero Section */}
          <div className="text-center max-w-4xl mx-auto mb-20">
            <div className="mb-8">
              <h1 className="text-6xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent animate-gradient">
                Q Business Tools
              </h1>
              <div className="h-1 w-32 mx-auto bg-gradient-to-r from-purple-400 to-blue-400 rounded-full"></div>
            </div>

            <p className="text-xl md:text-2xl text-gray-300 mb-6 leading-relaxed max-w-3xl mx-auto">
              A comprehensive suite of tools for monitoring, analyzing, and enhancing your Amazon Q
              Business experience.
            </p>
          </div>

          {/* Tool cards */}
          <div className="grid md:grid-cols-2 gap-8 mt-20 max-w-5xl mx-auto">
            <ToolCard
              icon={<Database className="w-8 h-8" />}
              title="Operations Dashboard"
              description="Monitor, analyze, and troubleshoot your Amazon Q Business data source sync jobs with powerful insights and visualizations."
              onClick={() => onSelectTool('operations')}
            />
            <ToolCard
              icon={<Search className="w-8 h-8" />}
              title="Unified Search"
              description="Search for content with an integrated Generative AI assistant to help you find exactly what you need."
              onClick={() => onSelectTool('search')}
              isNew={true}
              badge="Available"
            />
            <ToolCard
              icon={<MessageSquare className="w-8 h-8" />}
              title="AI Chat Bot"
              description="Chat with an AI assistant using customizable data sources to get intelligent, context-aware responses."
              onClick={() => onSelectTool('chat')}
              isNew={true}
              badge="Available"
            />
            <ToolCard
              icon={<CheckSquare className="w-8 h-8" />}
              title="Ground Truth Evaluation"
              description="Evaluate Q Business performance against ground truth datasets with an intuitive interface."
              onClick={() => onSelectTool('evaluation')}
              isNew={true}
              badge="Available"
            />
          </div>

          {/* Additional Info Section */}
          <div className="mt-32 text-center">
            <h2 className="text-3xl font-bold mb-4 text-gray-200">Powered by Amazon Q Business</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Leverage the full potential of Amazon Q Business with our comprehensive suite of tools
              designed for administrators and developers.
            </p>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full filter blur-3xl"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full filter blur-3xl"></div>
      </div>
    </div>
  );
};

export default ToolsLandingPage;
