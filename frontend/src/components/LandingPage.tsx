// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { ChevronRight, Database, Users, Shield, AlertCircle } from 'lucide-react';
import React from 'react';

interface LandingPageProps {
  onGetStarted: () => void;
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description }) => {
  return (
    <div className="bg-gray-900/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-800 hover:border-purple-500/50 transition-all duration-300 hover:transform hover:scale-105">
      <div className="text-purple-400 mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
};

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
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
                Q Business Dashboard
              </h1>
              <div className="h-1 w-32 mx-auto bg-gradient-to-r from-purple-400 to-blue-400 rounded-full"></div>
            </div>

            <p className="text-xl md:text-2xl text-gray-300 mb-12 leading-relaxed max-w-3xl mx-auto">
              Monitor, analyze, and troubleshoot your Amazon Q Business data source sync jobs with
              powerful insights and elegant visualizations.
            </p>

            <button
              onClick={onGetStarted}
              className="group inline-flex items-center gap-2 px-8 py-4 bg-white text-black rounded-full font-semibold text-lg hover:bg-gray-100 transition-all transform hover:scale-105 shadow-2xl hover:shadow-purple-500/25"
            >
              Get Started
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Feature cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-20">
            <FeatureCard
              icon={<Database className="w-8 h-8" />}
              title="Sync Metrics"
              description="Real-time overview of your data source sync operations with detailed performance metrics"
            />
            <FeatureCard
              icon={<Users className="w-8 h-8" />}
              title="Group Membership"
              description="Visualize groups and their members from sync logs with interactive exploration"
            />
            <FeatureCard
              icon={<Shield className="w-8 h-8" />}
              title="ACL Viewer"
              description="Inspect document permissions and access controls with powerful search capabilities"
            />
            <FeatureCard
              icon={<AlertCircle className="w-8 h-8" />}
              title="Error Analysis"
              description="Identify and troubleshoot sync failures with detailed error tracking"
            />
          </div>

          {/* Additional Info Section */}
          <div className="mt-32 text-center">
            <h2 className="text-3xl font-bold mb-4 text-gray-200">Built for AWS Administrators</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Seamlessly integrates with CloudWatch Logs, Amazon Kendra, and Q Business APIs to
              provide comprehensive operational insights.
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

export default LandingPage;
