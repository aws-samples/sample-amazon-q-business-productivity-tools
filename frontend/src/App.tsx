// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React, { useState, useEffect } from 'react';

import './index.css';
import AuthWrapper from './components/auth/AuthWrapper';
import LogoutButton from './components/auth/LogoutButton';
import HomeButton from './components/HomeButton';
import LandingPage from './components/LandingPage';
import Dashboard from './components/operations/Dashboard';
import ToolsLandingPage from './components/ToolsLandingPage';
import ChatBot from './components/unified-search/ChatBot';
import GroundTruthEvaluation from './components/unified-search/GroundTruthEvaluation';
import UnifiedSearch from './components/unified-search/UnifiedSearch';
import { COGNITO_CONFIG } from './constants/cognitoConfig';
import { AuthService, AuthProvider } from './services/AuthService';
import { Config } from './types/types';

function App() {
  const [view, setView] = useState<
    | 'tools-landing'
    | 'landing'
    | 'config'
    | 'dashboard'
    | 'search'
    | 'chat'
    | 'evaluation'
    | 'auth'
    | 'idp-auth'
    | 'setup-decision'
    | 'setup-flow'
  >('tools-landing');
  const [config, setConfig] = useState<Config | null>(null);
  useEffect(() => {
    // Check if there's a saved configuration
    const savedConfig = localStorage.getItem('application-configuration');

    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        setConfig(parsedConfig);
      } catch (error) {
        console.error('Failed to parse saved config:', error);
      }
    }

    // Set auth provider to Cognito - we only use Cognito authentication
    AuthService.setAuthProvider(AuthProvider.COGNITO);
  }, []);

  const handleSelectTool = (tool: string) => {
    // All tools require authentication with Cognito
    switch (tool) {
      case 'operations':
        // Go directly to dashboard without requiring configuration first
        setView('dashboard');
        break;
      case 'search':
      case 'chat':
      case 'evaluation':
        setView(tool as any);
        break;
      case 'auth':
        setView('auth');
        break;
      default:
        setView('tools-landing');
    }
  };

  const handleGetStarted = () => {
    setView('config');
  };

  const handleConfigChange = () => {
    setView('config');
  };

  const handleBackToTools = () => {
    setView('tools-landing');
  };

  // Configure Cognito on component mount
  useEffect(() => {
    // Configure Cognito with our settings from constants file
    const cognitoConfig = {
      userPoolId: COGNITO_CONFIG.USER_POOL_ID,
      clientId: COGNITO_CONFIG.CLIENT_ID,
      region: COGNITO_CONFIG.REGION,
      domainPrefix: COGNITO_CONFIG.DOMAIN_PREFIX,
    };

    AuthService.configureCognito(cognitoConfig);
  }, []);

  return (
    <AuthWrapper>
      <div className="App">
        {view === 'tools-landing' && (
          <>
            <div className="absolute top-4 right-4 z-[100]">
              <LogoutButton />
            </div>
            <ToolsLandingPage onSelectTool={handleSelectTool} />
          </>
        )}

        {view === 'landing' && <LandingPage onGetStarted={handleGetStarted} />}

        {view === 'dashboard' && (
          <>
            <HomeButton onClick={handleBackToTools} className="fixed top-4 left-4 z-[100]" />
            <div className="absolute top-4 right-4 z-[100]">
              <LogoutButton />
            </div>
            <Dashboard
              config={
                config || {
                  type: 'QBUSINESS',
                  applicationId: '',
                  indexId: '',
                  dataSourceId: '',
                  syncJobExecutionId: '',
                  retrieverId: '',
                }
              }
              onConfigChange={handleConfigChange}
            />
          </>
        )}

        {view === 'search' && (
          <>
            <HomeButton onClick={handleBackToTools} className="fixed top-4 left-4 z-[100]" />
            <div className="absolute top-4 right-4 z-[100]">
              <LogoutButton />
            </div>
            <UnifiedSearch />
          </>
        )}

        {view === 'chat' && (
          <>
            <HomeButton onClick={handleBackToTools} className="fixed top-4 left-4 z-[100]" />
            <div className="absolute top-4 right-4 z-[100]">
              <LogoutButton />
            </div>
            <ChatBot />
          </>
        )}

        {view === 'evaluation' && (
          <>
            <HomeButton onClick={handleBackToTools} className="fixed top-4 left-4 z-[100]" />
            <div className="absolute top-4 right-4 z-[100]">
              <LogoutButton />
            </div>
            <GroundTruthEvaluation />
          </>
        )}
      </div>
    </AuthWrapper>
  );
}

export default App;
