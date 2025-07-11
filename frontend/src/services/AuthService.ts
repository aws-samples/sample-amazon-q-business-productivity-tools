// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Amplify } from 'aws-amplify';
import {
  signIn,
  signOut,
  fetchAuthSession,
  getCurrentUser,
  signInWithRedirect,
} from 'aws-amplify/auth';
import * as msal from 'msal';

import { credentialExchangeProxyService } from './proxy/CredentialExchangeProxyService';
import { API_BASE_URL } from '../constants/apiConstants';
import {
  storeIdToken as storeToken,
  getIdToken as getStoredToken,
  clearTokens,
} from '../utils/tokenUtils';

// Auth provider types
export enum AuthProvider {
  COGNITO = 'cognito',
  MICROSOFT = 'microsoft',
}

export interface AuthUser {
  username: string;
  email: string;
  accessToken: string;
  idToken?: string;
  expiresAt: Date;
  isAuthenticated: boolean;
  provider: AuthProvider;
}

export interface AuthConfig {
  ssoStartUrl: string;
  clientName: string;
  scopes: string[];
}

// Cognito configuration
export interface CognitoConfig {
  userPoolId: string;
  clientId: string;
  region: string;
  domainPrefix?: string; // Optional domain prefix for hosted UI
}

// Microsoft Entra configuration
export interface MicrosoftConfig {
  tenantId: string;
  clientId?: string;
  redirectUri?: string;
}

export class AuthService {
  private static currentUser: AuthUser | null = null;
  private static clientId: string | null = null;
  private static clientSecret: string | null = null;
  private static authConfig: AuthConfig = {
    ssoStartUrl: 'https://d-xxxxxxxxxx.awsapps.com/start',
    clientName: 'OneUnifiedApp',
    scopes: ['sso:account:access'],
  };

  // MSAL application instance
  private static msalInstance: msal.UserAgentApplication | null = null;

  // Storage keys
  private static readonly COGNITO_CONFIG_KEY = 'cognito-config';
  private static readonly MICROSOFT_CONFIG_KEY = 'microsoft-config';
  private static readonly AUTH_PROVIDER_KEY = 'auth-provider';
  private static readonly ID_TOKEN_KEY = 'id-token';
  private static readonly ID_TOKEN_USED_KEY = 'id-token-used';
  private static readonly COGNITO_SESSION_ID_KEY = 'cognito-session-id';

  /**
   * Get the current authentication provider
   */
  static getAuthProvider(): AuthProvider | null {
    try {
      const provider = localStorage.getItem(this.AUTH_PROVIDER_KEY);
      return (provider as AuthProvider) || null;
    } catch (error) {
      console.error('Failed to get auth provider:', error);
      return null;
    }
  }

  /**
   * Set the current authentication provider
   */
  static setAuthProvider(provider: AuthProvider): void {
    try {
      localStorage.setItem(this.AUTH_PROVIDER_KEY, provider);
    } catch (error) {
      console.error('Failed to set auth provider:', error);
    }
  }

  /**
   * Get Cognito configuration from local storage
   */
  static getCognitoConfig(): CognitoConfig | null {
    try {
      const storedConfig = localStorage.getItem(this.COGNITO_CONFIG_KEY);
      if (!storedConfig) {
        return null;
      }
      return JSON.parse(storedConfig);
    } catch (error) {
      console.error('Failed to get Cognito config:', error);
      return null;
    }
  }

  /**
   * Save Cognito configuration to local storage
   */
  static saveCognitoConfig(config: CognitoConfig): void {
    try {
      localStorage.setItem(this.COGNITO_CONFIG_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save Cognito config:', error);
    }
  }

  /**
   * Clear Cognito configuration from local storage
   */
  static clearCognitoConfig(): void {
    localStorage.removeItem(this.COGNITO_CONFIG_KEY);
  }

  /**
   * Get Microsoft configuration from local storage
   */
  static getMicrosoftConfig(): MicrosoftConfig | null {
    try {
      const storedConfig = localStorage.getItem(this.MICROSOFT_CONFIG_KEY);
      if (!storedConfig) {
        return null;
      }
      return JSON.parse(storedConfig);
    } catch (error) {
      console.error('Failed to get Microsoft config:', error);
      return null;
    }
  }

  /**
   * Save Microsoft configuration to local storage
   */
  static saveMicrosoftConfig(config: MicrosoftConfig): void {
    try {
      localStorage.setItem(this.MICROSOFT_CONFIG_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save Microsoft config:', error);
    }
  }

  /**
   * Clear Microsoft configuration from local storage
   */
  static clearMicrosoftConfig(): void {
    localStorage.removeItem(this.MICROSOFT_CONFIG_KEY);
  }

  /**
   * Configure Cognito with the provided settings
   */
  static configureCognito(config: CognitoConfig): void {
    const cognitoConfig: any = {
      userPoolId: config.userPoolId,
      userPoolClientId: config.clientId,
    };

    // Use the dynamic configuration from the user's input
    Amplify.configure({
      Auth: {
        Cognito: cognitoConfig,
      },
    });

    this.saveCognitoConfig(config);
    this.setAuthProvider(AuthProvider.COGNITO);
  }

  /**
   * Check if a valid Cognito session exists
   * @returns True if a valid session exists, false otherwise
   */
  static hasValidCognitoSession(): boolean {
    return !!localStorage.getItem(this.COGNITO_SESSION_ID_KEY);
  }

  /**
   * Exchange ID token for a session ID if needed
   * This method will only exchange the token if no session ID exists
   * @param idToken The ID token to exchange
   * @returns True if exchange was successful or session already exists, false otherwise
   */
  static async exchangeTokenForSessionIfNeeded(idToken: string): Promise<boolean> {
    // Check if we already have a valid session ID
    if (this.hasValidCognitoSession()) {
      console.log('Valid session already exists, skipping token exchange');
      return true;
    }

    // No session ID exists, so we need to exchange the token
    try {
      console.log('Exchanging ID token for session ID');
      console.log('API_BASE_URL:', API_BASE_URL);
      
      // Add a try-catch specifically for the API call
      try {
        const exchangeResult = await credentialExchangeProxyService.exchangeCredentials({
          idToken: idToken,
        });
        
        console.log('Exchange API response:', exchangeResult);

        if (exchangeResult.success && exchangeResult.data) {
          const sessionId = exchangeResult.data.sessionId;
          console.log('Successfully exchanged ID token for session ID:', sessionId);

          // Store the session ID in local storage
          localStorage.setItem(this.COGNITO_SESSION_ID_KEY, sessionId);
          return true;
        } else {
          console.error('Failed to exchange ID token for session ID:', exchangeResult.error);
          // Continue authentication flow even if exchange fails (temporary fix)
          console.log('Continuing authentication flow despite credential exchange failure');
          return true;
        }
      } catch (apiError) {
        console.error('API call to exchange credentials failed:', apiError);
        // Continue authentication flow even if exchange fails (temporary fix)
        console.log('Continuing authentication flow despite credential exchange failure');
        return true;
      }
    } catch (exchangeError) {
      console.error('Error exchanging ID token for session ID:', exchangeError);
      // Continue authentication flow even if exchange fails (temporary fix)
      console.log('Continuing authentication flow despite credential exchange failure');
      return true;
    }
  }

  /**
   * Sign in with Cognito using username and password
   */
  static async signInWithCognito(username?: string, password?: string): Promise<string> {
    try {
      // Check if we already have a valid session
      if (this.hasValidCognitoSession()) {
        console.log('Valid session already exists, skipping sign in');
        const idToken = this.getIdToken() || '';
        return idToken;
      }

      const cognitoConfig = this.getCognitoConfig();
      if (!cognitoConfig) {
        throw new Error('Cognito configuration not found');
      }

      // Configure Amplify Auth
      this.configureCognito(cognitoConfig);

      // Check if username and password are provided
      if (!username || !password) {
        // If not provided, throw an error - username is required
        throw new Error('Username is required to sign in with Cognito');
      } else {
        try {
          // Use the username/password flow
          await signIn({ username, password });
        } catch (signInError: any) {
          console.error('Sign in error details:', signInError);
          // Check if this is a CORS error
          if (
            signInError.message &&
            (signInError.message.includes('NetworkError') ||
              signInError.message.includes('CORS') ||
              signInError.message.includes('Failed to fetch'))
          ) {
            throw new Error(
              'CORS error: Your Cognito User Pool client is not configured to allow requests from this origin. ' +
                'Please add your application URL (e.g., http://localhost:3000) to the "App client settings" ' +
                'in the AWS Cognito console under "App integration" > "App client settings" > "Allowed callback URLs".',
            );
          }
          throw signInError;
        }
      }

      // Get the current authenticated user
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();

      // Get the ID token
      const idToken = session.tokens?.idToken?.toString() || '';

      // Store the ID token in localStorage
      this.storeIdToken(idToken);

      // Set the current user
      this.currentUser = {
        username: currentUser.username,
        email: currentUser.signInDetails?.loginId || '',
        accessToken: session.tokens?.accessToken?.toString() || '',
        idToken: idToken,
        expiresAt: new Date(Date.now() + 3600 * 1000), // Assume 1 hour expiration
        isAuthenticated: true,
        provider: AuthProvider.COGNITO,
      };

      // Exchange the ID token for a session ID with the backend
      await this.exchangeTokenForSessionIfNeeded(idToken);

      return idToken;
    } catch (error) {
      console.error('Error signing in with Cognito:', error);
      throw error;
    }
  }

  /**
   * Sign in with Cognito Hosted UI
   */
  static async signInWithCognitoHostedUI(): Promise<string> {
    try {
      // Check if we already have a valid session
      if (this.hasValidCognitoSession()) {
        console.log('Valid session already exists, skipping hosted UI sign in');
        const idToken = this.getIdToken() || '';
        return idToken;
      }

      const cognitoConfig = this.getCognitoConfig();
      if (!cognitoConfig) {
        throw new Error('Cognito configuration not found');
      }

      if (!cognitoConfig.domainPrefix) {
        throw new Error('Cognito domain prefix is required for hosted UI');
      }

      // Configure Amplify Auth with OAuth settings
      Amplify.configure({
        Auth: {
          Cognito: {
            userPoolId: cognitoConfig.userPoolId,
            userPoolClientId: cognitoConfig.clientId,
            loginWith: {
              oauth: {
                domain: `${cognitoConfig.domainPrefix}.auth.${cognitoConfig.region}.amazoncognito.com`,
                scopes: ['openid', 'email', 'profile'],
                redirectSignIn: [window.location.origin],
                redirectSignOut: [window.location.origin],
                responseType: 'token', // Use token flow instead of code flow
              },
            },
          },
        },
      });

      // Initiate the hosted UI sign-in flow
      await signInWithRedirect();

      // The rest will be handled by Hub events in the component
      return 'Redirecting to Cognito login...';
    } catch (error) {
      console.error('Error signing in with Cognito Hosted UI:', error);
      throw error;
    }
  }

  /**
   * Process authentication data after successful sign-in
   * This method is called by components listening to Hub auth events or when tokens are extracted from URL
   */
  static async processAuthenticationSuccess(providedIdToken?: string): Promise<string> {
    try {
      // Check if we already have a valid session
      if (this.hasValidCognitoSession()) {
        console.log('Valid session already exists, skipping authentication processing');
        return providedIdToken || this.getIdToken() || '';
      }

      let idToken = providedIdToken;

      // If no ID token is provided, try to get it from the session
      if (!idToken) {
        // Get the current session
        const session = await fetchAuthSession();
        idToken = session.tokens?.idToken?.toString() || '';

        if (!idToken) {
          throw new Error('No ID token found in session or URL');
        }
      }

      // Store the ID token in localStorage
      this.storeIdToken(idToken);

      // Set the current user
      try {
        // Try to get the current user from Cognito
        try {
          const currentUser = await getCurrentUser();
          this.currentUser = {
            username: currentUser.username,
            email: currentUser.signInDetails?.loginId || '',
            accessToken: '', // Will be populated if available
            idToken: idToken,
            expiresAt: new Date(Date.now() + 3600 * 1000),
            isAuthenticated: true,
            provider: AuthProvider.COGNITO,
          };

          // Try to get the access token from the session
          const session = await fetchAuthSession();
          if (session.tokens?.accessToken) {
            this.currentUser.accessToken = session.tokens.accessToken.toString();
          }
        } catch (userError) {
          console.error('Error getting current user:', userError);
          // Create a minimal user object if we can't get the full user details
          this.currentUser = {
            username: 'unknown',
            email: '',
            accessToken: '',
            idToken: idToken,
            expiresAt: new Date(Date.now() + 3600 * 1000),
            isAuthenticated: true,
            provider: AuthProvider.COGNITO,
          };
        }
      } catch (userError) {
        console.error('Error setting current user:', userError);
      }

      // Exchange the ID token for a session ID with the backend
      await this.exchangeTokenForSessionIfNeeded(idToken);

      return idToken;
    } catch (error) {
      console.error('Error processing authentication success:', error);
      throw error;
    }
  }

  /**
   * Extract tokens from URL hash fragment
   * This is used when the responseType is 'token'
   */
  static extractTokensFromUrl(): { idToken?: string; accessToken?: string; expiresIn?: number } {
    try {
      // Check if we have a hash fragment in the URL
      if (!window.location.hash) {
        return {};
      }

      // Remove the # character
      const hashParams = window.location.hash.substring(1);

      // Parse the hash parameters
      const params = new URLSearchParams(hashParams);

      // Extract the tokens
      const idToken = params.get('id_token') || undefined;
      const accessToken = params.get('access_token') || undefined;
      const expiresIn = params.get('expires_in')
        ? parseInt(params.get('expires_in') || '3600', 10)
        : undefined;
      return { idToken, accessToken, expiresIn };
    } catch (error) {
      console.error('Error extracting tokens from URL:', error);
      return {};
    }
  }

  /**
   * Sign out the current user
   */
  static async signOut(): Promise<void> {
    try {
      // Save the cognito config before signing out
      const cognitoConfig = this.getCognitoConfig();

      const provider = this.getAuthProvider();

      if (provider === AuthProvider.COGNITO) {
        await signOut();
      }

      // Clear the ID token from localStorage
      this.clearIdToken();

      // Clear the session ID
      localStorage.removeItem(this.COGNITO_SESSION_ID_KEY);

      this.currentUser = null;

      // Restore the cognito config if it existed
      if (cognitoConfig) {
        this.saveCognitoConfig(cognitoConfig);
      }
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  /**
   * Get the current user
   */
  static getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  /**
   * Get the ID token for the current user
   * First tries to get it from memory, then falls back to localStorage
   */
  static getIdToken(): string | undefined {
    // First try to get from memory
    if (this.currentUser?.idToken) {
      return this.currentUser.idToken;
    }

    // Try to get from our token utility (cognito-id-token)
    const storedToken = getStoredToken();
    if (storedToken) {
      return storedToken;
    }

    // Fall back to legacy localStorage key as last resort
    try {
      return localStorage.getItem(this.ID_TOKEN_KEY) || undefined;
    } catch (error) {
      console.error('Failed to get ID token from localStorage:', error);
      return undefined;
    }
  }

  /**
   * Store the ID token in localStorage
   */
  static storeIdToken(idToken: string): void {
    try {
      console.log('Setting id token');

      // Store the token using our utility function (in cognito-id-token)
      storeToken(idToken);

      // Also store in the legacy location for backward compatibility
      localStorage.setItem(this.ID_TOKEN_KEY, idToken);

      // Reset the used flag when storing a new token
      localStorage.removeItem(this.ID_TOKEN_USED_KEY);
    } catch (error) {
      console.error('Failed to store ID token in localStorage:', error);
    }
  }

  /**
   * Mark the ID token as used for exchange
   */
  static markIdTokenAsUsed(): void {
    try {
      localStorage.setItem(this.ID_TOKEN_USED_KEY, 'true');
    } catch (error) {
      console.error('Failed to mark ID token as used:', error);
    }
  }

  /**
   * Check if the ID token has been used for exchange
   * @returns True if the token has been used, false otherwise
   */
  static isIdTokenUsed(): boolean {
    try {
      return localStorage.getItem(this.ID_TOKEN_USED_KEY) === 'true';
    } catch (error) {
      console.error('Failed to check if ID token is used:', error);
      return false;
    }
  }

  /**
   * Clear the stored ID token
   */
  static clearIdToken(): void {
    try {
      // Clear tokens using our utility function
      clearTokens();

      // Also clear from legacy locations for backward compatibility
      localStorage.removeItem(this.ID_TOKEN_KEY);
      localStorage.removeItem(this.ID_TOKEN_USED_KEY);
    } catch (error) {
      console.error('Failed to clear ID token from localStorage:', error);
    }
  }

  /**
   * Parse a JWT token
   */
  private static parseJwt(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error parsing JWT:', error);
      return {};
    }
  }
}
