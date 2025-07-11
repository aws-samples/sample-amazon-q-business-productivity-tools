// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { STORAGE_KEYS } from '../constants/cognitoConfig';

/**
 * Token utilities for managing authentication tokens
 */

/**
 * Store the ID token in local storage
 * @param idToken The ID token to store
 */
export const storeIdToken = (idToken: string): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.ID_TOKEN, idToken);
  } catch (error) {
    console.error('Failed to store ID token:', error);
  }
};

/**
 * Get the ID token from local storage
 * @returns The ID token or null if not found
 */
export const getIdToken = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.ID_TOKEN);
  } catch (error) {
    console.error('Failed to get ID token:', error);
    return null;
  }
};

/**
 * Store the access token in local storage
 * @param accessToken The access token to store
 */
export const storeAccessToken = (accessToken: string): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  } catch (error) {
    console.error('Failed to store access token:', error);
  }
};

/**
 * Get the access token from local storage
 * @returns The access token or null if not found
 */
export const getAccessToken = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  } catch (error) {
    console.error('Failed to get access token:', error);
    return null;
  }
};

/**
 * Store the refresh token in local storage
 * @param refreshToken The refresh token to store
 */
export const storeRefreshToken = (refreshToken: string): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  } catch (error) {
    console.error('Failed to store refresh token:', error);
  }
};

/**
 * Get the refresh token from local storage
 * @returns The refresh token or null if not found
 */
export const getRefreshToken = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  } catch (error) {
    console.error('Failed to get refresh token:', error);
    return null;
  }
};

/**
 * Clear all tokens from local storage
 */
export const clearTokens = (): void => {
  try {
    // Save the cognito-config before clearing tokens
    const cognitoConfig = localStorage.getItem('cognito-config');

    localStorage.removeItem(STORAGE_KEYS.ID_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem('cognito-session-id');
    localStorage.removeItem('session-id');

    // Restore the cognito-config if it existed
    if (cognitoConfig) {
      localStorage.setItem('cognito-config', cognitoConfig);
    }
  } catch (error) {
    console.error('Failed to clear tokens:', error);
  }
};

/**
 * Parse a JWT token and return the payload
 * @param token The JWT token to parse
 * @returns The decoded payload or null if invalid
 */
export const parseJwt = (token: string): any => {
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
    return null;
  }
};

/**
 * Check if a token is expired
 * @param token The JWT token to check
 * @returns True if the token is expired, false otherwise
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = parseJwt(token);
    if (!decoded || !decoded.exp) {
      return true;
    }

    // exp is in seconds, Date.now() is in milliseconds
    const currentTime = Date.now() / 1000;
    return decoded.exp < currentTime;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true;
  }
};

/**
 * Store user data in local storage
 * @param userData The user data to store
 */
export const storeUserData = (userData: any): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
  } catch (error) {
    console.error('Failed to store user data:', error);
  }
};

/**
 * Get user data from local storage
 * @returns The user data or null if not found
 */
export const getUserData = (): any => {
  try {
    const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Failed to get user data:', error);
    return null;
  }
};
