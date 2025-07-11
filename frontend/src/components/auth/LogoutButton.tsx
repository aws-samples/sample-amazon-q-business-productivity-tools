// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React from 'react';

import { AuthService } from '../../services/AuthService';
import { clearTokens } from '../../utils/tokenUtils';

interface LogoutButtonProps {
  onLogout?: () => void;
  className?: string;
}

/**
 * Logout button component that signs the user out of Cognito,
 * clears all Cognito-related local storage items except cognito-config,
 * and redirects the user back to the login page
 */
const LogoutButton: React.FC<LogoutButtonProps> = ({ onLogout, className = '' }) => {
  const handleLogout = async () => {
    try {
      // Save the cognito-config before signing out
      const cognitoConfig = localStorage.getItem('cognito-config');

      // Sign out from Cognito
      await AuthService.signOut();

      // Clear all tokens from local storage
      clearTokens();

      // Clear all Cognito-related items from local storage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.toLowerCase().includes('cognito') && key !== 'cognito-config') {
          localStorage.removeItem(key);
        }
      }

      // Clear other auth-related items
      localStorage.removeItem('cognito-session-id');
      localStorage.removeItem('session-id');
      localStorage.removeItem('auth-provider');
      localStorage.removeItem('id-token');
      localStorage.removeItem('id-token-used');

      // Restore the cognito-config if it existed
      if (cognitoConfig) {
        localStorage.setItem('cognito-config', cognitoConfig);
      }

      // Call the onLogout callback if provided
      if (onLogout) {
        onLogout();
      }

      // Redirect to the login page instead of reloading
      window.location.href = window.location.origin;
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <button
      onClick={handleLogout}
      className={`px-4 py-2 text-white bg-red-500 rounded hover:bg-red-600 ${className}`}
    >
      Sign Out
    </button>
  );
};

export default LogoutButton;
