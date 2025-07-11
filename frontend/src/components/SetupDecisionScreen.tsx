// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Check } from 'lucide-react';
import React from 'react';

interface SetupDecisionScreenProps {
  onContinueToIDP: () => void;
  onGoToDashboard: () => void;
}

const SetupDecisionScreen: React.FC<SetupDecisionScreenProps> = ({
  onContinueToIDP,
  onGoToDashboard,
}) => {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-black to-blue-900/10"></div>
        <div className="relative z-10 container mx-auto px-6 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Operations Dashboard Configured!
            </h2>
            <p className="text-xl text-gray-300 mb-12">
              You've successfully configured the Operations Dashboard. Would you like to continue
              setup for additional features?
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              <button
                onClick={onGoToDashboard}
                className="py-4 px-6 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-all"
              >
                Start Using Operations Dashboard
              </button>
              <button
                onClick={onContinueToIDP}
                className="py-4 px-6 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-all"
              >
                Continue Setup for Advanced Features
              </button>
            </div>

            <div className="mt-8 p-4 bg-blue-900/20 border border-blue-800/50 rounded-lg">
              <p className="text-sm text-blue-300">
                <strong>Note:</strong> Unified Search, ChatBot, and Ground Truth Evaluation features
                require additional authentication setup.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupDecisionScreen;
