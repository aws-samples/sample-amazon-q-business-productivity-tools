// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { fetchAuthSession } from '@aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { AlertCircle, ExternalLink, RefreshCw, Save, Shield, Trash2 } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { AuthService, CognitoConfig } from '../../services/AuthService';
import { cognitoConfigProxyService } from '../../services/proxy/CognitoConfigProxyService';
import { credentialExchangeProxyService } from '../../services/proxy/CredentialExchangeProxyService';

interface CognitoAuthComponentProps {
  onAuthSuccess?: (idToken: string, instanceArn: string) => void;
}

const CognitoAuthComponent: React.FC<CognitoAuthComponentProps> = ({ onAuthSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [userPoolId, setUserPoolId] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');
  const [region, setRegion] = useState<string>('us-east-1');
  const [domainPrefix, setDomainPrefix] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savedConfig, setSavedConfig] = useState<CognitoConfig | null>(null);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [useHostedUI, setUseHostedUI] = useState<boolean>(true);

  // Load saved configuration on component mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // First try to get config from backend
        const backendConfig = await cognitoConfigProxyService.fetchCognitoConfig();
        if (backendConfig) {
          const cognitoConfig = {
            userPoolId: backendConfig.USER_POOL_ID,
            clientId: backendConfig.CLIENT_ID,
            region: backendConfig.REGION || 'us-east-1',
            domainPrefix: backendConfig.DOMAIN_PREFIX,
          };

          // Save the config to local storage
          AuthService.configureCognito(cognitoConfig);

          // Update the component state
          setSavedConfig(cognitoConfig);
          setRegion(cognitoConfig.region);
          setUserPoolId(cognitoConfig.userPoolId);
          setClientId(cognitoConfig.clientId);
          if (cognitoConfig.domainPrefix) {
            setDomainPrefix(cognitoConfig.domainPrefix);
          }

          console.log('Loaded Cognito config from backend:', cognitoConfig);
          return;
        }
      } catch (error) {
        console.error(
          'Failed to load Cognito config from backend, falling back to local storage:',
          error,
        );
      }

      // Fallback to local storage if backend call fails
      const config = AuthService.getCognitoConfig();
      if (config) {
        setSavedConfig(config);
        setRegion(config.region);
        setUserPoolId(config.userPoolId);
        setClientId(config.clientId);
        if (config.domainPrefix) {
          setDomainPrefix(config.domainPrefix);
        }
      }
    };

    loadConfig();
  }, []);

  // Set up Hub listener for auth events
  useEffect(() => {
    // Set up Hub listener for auth events
    const listener = Hub.listen('auth', async ({ payload }) => {
      const { event } = payload;

      if (event === 'signedIn' || event === 'tokenRefresh') {
        console.log('User signed in successfully via Hub event');
        handleAuthSuccess();
      } else if (event === 'signedOut') {
        console.log('User signed out');
        // Handle sign out if needed
      } else if (event === 'signInWithRedirect_failure' || event === 'tokenRefresh_failure') {
        console.error('Sign in failure:', payload);
        // Safely access error message from payload
        const errorMessage =
          typeof payload === 'object' && payload !== null && 'message' in payload
            ? String(payload.message)
            : 'Unknown error';
        setError('Authentication failed: ' + errorMessage);
      }
    });

    // Check if we're returning from a Cognito redirect with tokens in the URL hash
    const { idToken, accessToken } = AuthService.extractTokensFromUrl();

    if (idToken) {
      console.log('ID token found in URL hash, processing authentication');

      // Clean up the URL by removing the hash fragment
      window.history.replaceState({}, document.title, window.location.pathname);

      // Process the authentication with the ID token from the URL
      handleAuthSuccess(idToken);
    } else {
      // If no tokens in URL hash, check if we already have a session
      const checkExistingSession = async () => {
        try {
          const session = await fetchAuthSession();
          if (session.tokens?.idToken) {
            console.log('Existing session found, processing authentication');
            handleAuthSuccess();
          }
        } catch (error) {
          console.log('No existing session found');
        }
      };

      checkExistingSession();
    }

    // Clean up the listener when the component unmounts
    return () => {
      listener();
    };
  }, [onAuthSuccess]);

  // Function to handle successful authentication
  const handleAuthSuccess = async (providedIdToken?: string) => {
    try {
      console.log('Handling authentication success - exchanging ID token for session ID');
      setLoading(true);

      // Process the authentication success using the AuthService
      const idToken = await AuthService.processAuthenticationSuccess(providedIdToken);

      console.log('ID token obtained and processed');
      setSuccess(`Successfully signed in with Cognito Hosted UI`);

      // If onAuthSuccess is provided, call it with the ID token and instance ARN
      const config = AuthService.getCognitoConfig();
      if (onAuthSuccess && config) {
        onAuthSuccess(idToken, config.userPoolId);
      }
    } catch (error: any) {
      console.error('Error handling authentication success:', error);
      setError(error.message || 'Failed to process authentication');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!userPoolId) {
        throw new Error('Please enter a user pool ID');
      }

      if (!clientId) {
        throw new Error('Please enter a client ID');
      }

      if (useHostedUI && !domainPrefix) {
        throw new Error('Please enter a domain prefix for the hosted UI');
      }

      const config: CognitoConfig = {
        userPoolId: userPoolId,
        clientId: clientId,
        region: region,
      };

      if (useHostedUI) {
        config.domainPrefix = domainPrefix;
      }

      AuthService.configureCognito(config);
      setSavedConfig(config);
      setSuccess('Cognito configuration saved successfully');
    } catch (error: any) {
      console.error('Error saving Cognito config:', error);
      setError(error.message || 'Failed to save Cognito configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleClearConfig = () => {
    AuthService.clearCognitoConfig();
    setSavedConfig(null);
    setUserPoolId('');
    setClientId('');
    setRegion('us-east-1');
    setSuccess('Cognito configuration cleared');
  };

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!savedConfig) {
        throw new Error('Please configure and save Cognito settings first');
      }

      // Check if we already have a valid session
      if (AuthService.hasValidCognitoSession()) {
        console.log('Valid session already exists, proceeding with existing session');
        const idToken = AuthService.getIdToken() || '';

        setSuccess('Already signed in with a valid session');

        // If onAuthSuccess is provided, call it with the ID token and instance ARN
        if (onAuthSuccess && savedConfig) {
          onAuthSuccess(idToken, savedConfig.userPoolId);
        }
        return;
      }

      if (useHostedUI) {
        // Use the hosted UI flow
        if (!savedConfig.domainPrefix) {
          throw new Error(
            'Domain prefix is required for hosted UI. Please update your configuration.',
          );
        }

        console.log('Initiating Cognito Hosted UI sign-in');
        await AuthService.signInWithCognitoHostedUI();

        // The rest will be handled in the redirect callback
      } else {
        // Use the username/password flow
        if (!username) {
          throw new Error('Username is required to sign in');
        }

        if (!password) {
          throw new Error('Password is required to sign in');
        }

        const idToken = await AuthService.signInWithCognito(username, password);

        // Check if we have a session ID after sign-in
        if (AuthService.hasValidCognitoSession()) {
          setSuccess('Successfully signed in with Cognito');
        } else {
          setSuccess('Signed in with Cognito, but no session ID was created');
        }

        // If onAuthSuccess is provided, call it with the ID token and instance ARN
        if (onAuthSuccess && savedConfig) {
          onAuthSuccess(idToken, savedConfig.userPoolId);
        }
      }
    } catch (error: any) {
      console.error('Error signing in with Cognito:', error);
      setError(error.message || 'Failed to sign in with Cognito');
    } finally {
      setLoading(false);
    }
  };

  const regions = [
    'us-east-1',
    'us-east-2',
    'us-west-1',
    'us-west-2',
    'af-south-1',
    'ap-east-1',
    'ap-south-1',
    'ap-northeast-1',
    'ap-northeast-2',
    'ap-northeast-3',
    'ap-southeast-1',
    'ap-southeast-2',
    'ca-central-1',
    'eu-central-1',
    'eu-west-1',
    'eu-west-2',
    'eu-west-3',
    'eu-north-1',
    'eu-south-1',
    'me-south-1',
    'sa-east-1',
  ];

  return (
    <div className="bg-gray-900/50 backdrop-blur-lg rounded-2xl border border-gray-800 p-8">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-8 h-8 text-blue-400 flex-shrink-0" />
        <div>
          <h2 className="text-2xl font-bold">Cognito Authentication</h2>
          <p className="text-gray-400 text-sm mt-1">Configure Amazon Cognito for authentication</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-800/50 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>

          {error.includes('CORS') && (
            <div className="mt-4 border-t border-red-800/50 pt-4">
              <h4 className="text-sm font-medium text-red-300 mb-2">How to fix CORS issues:</h4>
              <ol className="list-decimal list-inside text-xs text-red-300 space-y-2">
                <li>Go to the AWS Cognito console</li>
                <li>Select your User Pool</li>
                <li>Go to "App integration" tab</li>
                <li>Under "App clients and analytics", click on your app client</li>
                <li>
                  In the "Hosted UI" section, add your application URL (e.g.,{' '}
                  <code className="bg-red-900/30 px-1 rounded">http://localhost:3000</code>) to:
                  <ul className="list-disc list-inside ml-4 mt-1">
                    <li>Allowed callback URLs</li>
                    <li>Allowed sign-out URLs</li>
                    <li>Allowed origins (CORS)</li>
                  </ul>
                </li>
                <li>Click "Save changes"</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-900/20 border border-green-800/50 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-green-400" />
            <p className="text-sm text-green-300">{success}</p>
          </div>
        </div>
      )}

      {savedConfig ? (
        <div className="mb-6 p-4 bg-blue-900/20 border border-blue-800/50 rounded-lg">
          <h3 className="text-lg font-medium text-blue-300 mb-2">Saved Configuration</h3>
          <div className="space-y-2 text-sm text-gray-300">
            <p>
              <span className="text-gray-400">User Pool ID:</span> {savedConfig.userPoolId}
            </p>
            <p>
              <span className="text-gray-400">Client ID:</span> {savedConfig.clientId}
            </p>
            <p>
              <span className="text-gray-400">Region:</span> {savedConfig.region}
            </p>
            {savedConfig.domainPrefix && (
              <p>
                <span className="text-gray-400">Domain Prefix:</span> {savedConfig.domainPrefix}
              </p>
            )}
          </div>

          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="useHostedUI"
                checked={useHostedUI}
                onChange={(e) => setUseHostedUI(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-900 border-gray-700 rounded focus:ring-blue-500 focus:ring-offset-gray-800"
                disabled={loading}
              />
              <label htmlFor="useHostedUI" className="text-sm font-medium text-gray-300">
                Use Cognito Hosted UI (Recommended)
              </label>
            </div>

            {!useHostedUI && (
              <>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 hover:border-gray-600 transition-all"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 hover:border-gray-600 transition-all"
                    disabled={loading}
                  />
                </div>
              </>
            )}
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSignIn}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : useHostedUI ? (
                <ExternalLink className="w-4 h-4" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              {useHostedUI ? 'Sign In with Hosted UI' : 'Sign In with Cognito'}
            </button>
            <button
              onClick={handleClearConfig}
              className="px-4 py-2 bg-red-600/30 hover:bg-red-600/50 text-red-300 rounded-lg font-medium transition-all flex items-center gap-2"
              disabled={loading}
            >
              <Trash2 className="w-4 h-4" />
              Clear Configuration
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">Region</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 hover:border-gray-600 transition-all"
              disabled={loading}
            >
              {regions.map((r) => (
                <option key={r} value={r} className="bg-gray-900">
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">User Pool ID</label>
            <input
              type="text"
              value={userPoolId}
              onChange={(e) => setUserPoolId(e.target.value)}
              placeholder="e.g., us-east-1_abcdefghi"
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 hover:border-gray-600 transition-all"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter your Cognito User Pool ID from the AWS Console
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">Client ID</label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="e.g., 1a2b3c4d5e6f7g8h9i0j"
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 hover:border-gray-600 transition-all"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter your Cognito App Client ID from the AWS Console
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">Domain Prefix</label>
            <input
              type="text"
              value={domainPrefix}
              onChange={(e) => setDomainPrefix(e.target.value)}
              placeholder="e.g., my-app-login"
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 hover:border-gray-600 transition-all"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter your Cognito domain prefix for the hosted UI (e.g., if your domain is
              my-app-login.auth.us-east-1.amazoncognito.com, enter "my-app-login")
            </p>
            <div className="mt-2 p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg">
              <p className="text-xs text-blue-300">
                <strong>Important:</strong> Make sure to configure your Cognito User Pool App Client
                to:
              </p>
              <ul className="list-disc list-inside text-xs text-blue-300 mt-1">
                <li>Enable "Cognito User Pool" as an identity provider</li>
                <li>
                  Add <code className="bg-blue-900/30 px-1 rounded">{window.location.origin}</code>{' '}
                  to Allowed callback URLs
                </li>
                <li>
                  Add <code className="bg-blue-900/30 px-1 rounded">{window.location.origin}</code>{' '}
                  to Allowed sign-out URLs
                </li>
                <li>Enable "Implicit grant" flow and check "token" option</li>
                <li>Select the OpenID scopes (openid, email, profile)</li>
              </ul>
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={handleSaveConfig}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || !userPoolId || !clientId}
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              Save Configuration
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CognitoAuthComponent;
