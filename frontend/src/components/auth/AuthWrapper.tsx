// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Hub } from 'aws-amplify/utils';
import React, { useEffect, useState, useCallback } from 'react';

import { COGNITO_CONFIG } from '../../constants/cognitoConfig';
import { AuthService, AuthProvider } from '../../services/AuthService';
import { cognitoConfigProxyService } from '../../services/proxy/CognitoConfigProxyService';
import { credentialExchangeProxyService } from '../../services/proxy/CredentialExchangeProxyService';
import {
  storeIdToken,
  getIdToken,
  isTokenExpired,
  parseJwt,
  storeUserData,
  storeAccessToken,
} from '../../utils/tokenUtils';

interface AuthWrapperProps {
  children: React.ReactNode;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Configure Cognito with our settings
  const configureCognito = async () => {
    try {
      // Fetch Cognito configuration from the backend
      const configFromBackend = await cognitoConfigProxyService.fetchCognitoConfig();

      // Create the config object using the values from the backend
      const cognitoConfig = {
        userPoolId: configFromBackend.userPoolId,
        clientId: configFromBackend.clientId,
        region: configFromBackend.region,
        domainPrefix: configFromBackend.domainPrefix,
      };

      // Set auth provider to Cognito - we only use Cognito authentication
      AuthService.setAuthProvider(AuthProvider.COGNITO);
      AuthService.configureCognito(cognitoConfig);
    } catch (error) {
      console.error(
        'Failed to fetch Cognito config from backend, falling back to static config:',
        error,
      );
    }
  };

  // Handle successful authentication
  const handleSuccessfulAuth = useCallback(async () => {
    try {
      console.log('Handling successful authentication');

      // Check if we already have a valid session
      if (AuthService.hasValidCognitoSession()) {
        console.log('Valid session already exists, skipping authentication processing');
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      // Set authenticated state to true early to ensure UI updates
      setIsAuthenticated(true);

      try {
        // Process authentication with AuthService
        const idToken = await AuthService.processAuthenticationSuccess();
        console.log('Authentication processing completed successfully');

        // Store the ID token in local storage using our utility
        if (idToken) {
          storeIdToken(idToken);

          // Extract and store user data
          const userData = parseJwt(idToken);
          if (userData) {
            storeUserData(userData);
            console.log('User data stored from token');
          }
        }
      } catch (authError) {
        console.error('Error in authentication processing, but continuing:', authError);
        // We already set isAuthenticated to true, so we'll continue
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error processing authentication:', error);

      // Check if we have a token anyway and force authentication
      const storedToken = getIdToken();
      if (storedToken) {
        console.log('Found stored token despite error, forcing authentication');
        setIsAuthenticated(true);
      }

      setIsLoading(false);
    }
  }, []);

  // Register auth event listener
  const registerAuthListener = useCallback(() => {
    return Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signInWithRedirect':
          console.log('Redirecting to Cognito login...');
          break;
        case 'signInWithRedirect_failure':
          console.error('Error signing in:', payload.data);
          setIsLoading(false);
          break;
        case 'customOAuthState':
          console.log('Custom OAuth state received');
          break;
        case 'signedIn':
          console.log('Successfully signed in');
          handleSuccessfulAuth();
          break;
        case 'signedOut':
          console.log('User signed out');
          setIsAuthenticated(false);
          break;
      }
    });
  }, [handleSuccessfulAuth]);

  // Check if we have tokens in the URL (after redirect from Cognito Hosted UI)
  const checkTokensFromUrl = async () => {
    try {
      console.log('Checking for tokens in URL...');
      console.log('Current URL:', window.location.href);

      const tokens = AuthService.extractTokensFromUrl();
      console.log('Extracted tokens:', tokens);

      if (tokens.idToken) {
        console.log('Found ID token in URL');

        // Store the tokens in local storage
        storeIdToken(tokens.idToken);
        if (tokens.accessToken) {
          storeAccessToken(tokens.accessToken);
        }

        // Extract user information from the ID token
        const userData = parseJwt(tokens.idToken);
        if (userData) {
          storeUserData(userData);
          console.log('User data extracted from token:', userData);
        }

        console.log('Stored user data');

        // IMPORTANT: Force authentication state to true and loading to false
        // regardless of what happens next
        setIsAuthenticated(true);
        setIsLoading(false);

        console.log('Set authenticated=true and loading=false');

        // DIRECT CALL to credential exchange service to ensure it's being called
        try {
          console.log('Making direct call to credentialExchangeProxyService.exchangeCredentials');
          const exchangeResult = await credentialExchangeProxyService.exchangeCredentials({
            idToken: tokens.idToken,
          });
          console.log('Direct credential exchange result:', exchangeResult);

          if (exchangeResult.success && exchangeResult.data) {
            console.log(
              'Successfully exchanged ID token for session ID:',
              exchangeResult.data.sessionId,
            );
            localStorage.setItem('cognito-session-id', exchangeResult.data.sessionId);
          } else {
            console.error('Failed to exchange ID token for session ID:', exchangeResult.error);
          }
        } catch (exchangeError) {
          console.error('Error in direct credential exchange call:', exchangeError);
        }

        // Process authentication with AuthService
        try {
          await AuthService.processAuthenticationSuccess(tokens.idToken);
          console.log('Authentication processing completed successfully');
        } catch (authError) {
          console.error('Error during authentication processing:', authError);
          // Continue anyway since we have the ID token
          console.log('Continuing despite authentication processing error');
        }

        // Clear the URL hash to remove the tokens
        window.history.replaceState({}, document.title, window.location.pathname);
        console.log('Cleared URL hash');
      } else {
        console.log('No ID token found in URL');
      }
    } catch (error) {
      console.error('Error processing tokens from URL:', error);
      // Force authentication if we have a token in localStorage
      const storedToken = getIdToken();
      if (storedToken) {
        console.log('Found stored token, forcing authentication');
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    }
  };

  // Check if we already have a valid ID token or session
  const checkExistingAuth = async () => {
    console.log('Checking for existing authentication...');

    // First check if we have a valid session
    if (AuthService.hasValidCognitoSession()) {
      console.log('Found existing valid session');
      setIsAuthenticated(true);
      setIsLoading(false);
      return;
    }

    // If no valid session, check for ID token
    let idToken = AuthService.getIdToken();
    console.log('AuthService.getIdToken() returned:', idToken ? 'token found' : 'no token');

    // If not found, try to get from our token utils (local storage)
    if (!idToken) {
      const storedToken = getIdToken();
      if (storedToken) {
        idToken = storedToken;
        console.log('Found token in local storage');
      }
    }

    if (idToken) {
      console.log('Found existing ID token');

      // Check if the token is expired
      const expired = isTokenExpired(idToken);
      console.log('Token expired?', expired);

      if (!expired) {
        console.log('Token is still valid, proceeding with authentication');

        try {
          // Try to exchange the ID token for a session ID, but continue even if it fails
          await AuthService.exchangeTokenForSessionIfNeeded(idToken);
        } catch (error) {
          console.error('Error exchanging token, but continuing anyway:', error);
        }

        // Set authenticated regardless of exchange result
        setIsAuthenticated(true);
      } else {
        console.log('ID token is expired, user needs to login again');
      }
    } else {
      console.log('No existing ID token found');
    }

    setIsLoading(false);
  };

  // Initiate login with Cognito Hosted UI
  const login = async () => {
    try {
      setIsLoading(true);
      await AuthService.signInWithCognitoHostedUI();
      // The rest will be handled by the Hub listener
    } catch (error) {
      console.error('Error initiating login:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Configure Cognito with our settings (async)
    const initAuth = async () => {
      await configureCognito();

      // Check if we have tokens in the URL (after redirect from Cognito Hosted UI)
      await checkTokensFromUrl();

      // Check if we already have a valid ID token or session
      await checkExistingAuth();
    };

    initAuth();

    // Listen for auth events
    const hubListener = registerAuthListener();

    return () => {
      // Clean up the listener when component unmounts
      hubListener();
    };
  }, [registerAuthListener]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="relative">
          {/* Animated gradient background */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20"></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/10 via-transparent to-purple-900/10 animate-pulse"></div>
          </div>

          {/* Content */}
          <div className="relative z-10 max-w-md w-full p-8 bg-gray-900/50 backdrop-blur-lg rounded-2xl border border-gray-800">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent animate-gradient">
                Q Business Tools
              </h1>
              <div className="h-1 w-24 mx-auto bg-gradient-to-r from-purple-400 to-blue-400 rounded-full"></div>
            </div>

            <div className="flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-t-purple-500 border-r-transparent border-b-blue-500 border-l-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-xl text-gray-300">Loading...</p>
            </div>

            {/* Decorative elements */}
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full filter blur-xl"></div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full filter blur-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="relative">
          {/* Animated gradient background */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20"></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/10 via-transparent to-purple-900/10 animate-pulse"></div>
          </div>

          {/* Content */}
          <div className="relative z-10 max-w-md w-full p-8 bg-gray-900/50 backdrop-blur-lg rounded-2xl border border-gray-800">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent animate-gradient">
                Q Business Tools
              </h1>
              <div className="h-1 w-24 mx-auto bg-gradient-to-r from-purple-400 to-blue-400 rounded-full"></div>
            </div>

            <h2 className="text-2xl font-bold mb-4 text-center">Welcome</h2>
            <p className="mb-6 text-gray-300 text-center">
              Please log in to access the Q Business Tools suite for monitoring, analyzing, and
              enhancing your Amazon Q Business experience.
            </p>

            <button
              onClick={login}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium rounded-lg hover:opacity-90 transition-all duration-300 flex items-center justify-center"
            >
              <span>Sign In</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 ml-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {/* Decorative elements */}
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full filter blur-xl"></div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full filter blur-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthWrapper;
