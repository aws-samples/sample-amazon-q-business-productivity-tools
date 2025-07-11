// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Loader2, AlertCircle } from 'lucide-react';
import React, { useState } from 'react';

import { credentialExchangeProxyService } from '../../services/proxy/CredentialExchangeProxyService';

interface AnonymousAuthComponentProps {
  onAuthSuccess: (token: string, instanceArn: string) => void;
}

const AnonymousAuthComponent: React.FC<AnonymousAuthComponentProps> = ({ onAuthSuccess }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      // Generate a simple anonymous token
      const anonymousToken = generateAnonymousToken();

      // Use a placeholder instance ARN for anonymous access
      const instanceArn = 'anonymous-instance';

      // Call CredentialExchangeProxyService to exchange for anonymous access
      try {
        // Call exchangeForAnonymousAccess without the IAM Role (now comes from environment variable)
        const response = await credentialExchangeProxyService.exchangeForAnonymousAccess();

        if (response.success) {
          console.log('Successfully assumed role for anonymous access:', response.data);
          // The session ID is already stored by the exchangeForAnonymousAccess method
        } else {
          console.error('Error exchanging credentials for anonymous access:', response.error);
          // Continue with authentication even if credential exchange fails
        }
      } catch (credError) {
        console.error('Error exchanging credentials for anonymous access:', credError);
        // Continue with authentication even if credential exchange fails
      }

      // Call the success callback with the generated token
      onAuthSuccess(anonymousToken, instanceArn);
    } catch (error) {
      console.error('Error in anonymous authentication:', error);
      setError('Failed to authenticate anonymously. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Generate a simple token for anonymous access
  const generateAnonymousToken = (): string => {
    // Create a simple JWT-like structure with timestamp
    const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
    const payload = btoa(
      JSON.stringify({
        sub: 'anonymous-user',
        name: 'Anonymous User',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiration
        iss: 'anonymous-access',
        aud: 'one-unified-app',
      }),
    );

    // Return a token in JWT format (header.payload.signature)
    // For anonymous access, we use a placeholder signature
    return `${header}.${payload}.anonymous`;
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-800/50 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <p className="text-sm text-gray-300">
          Continue with anonymous access to use QBusiness tools without authentication. The server
          will use the configured role ARN from environment variables.
        </p>

        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-purple-500 hover:bg-purple-600 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <span>Continue as Anonymous</span>
          )}
        </button>
      </form>
    </div>
  );
};

export default AnonymousAuthComponent;
