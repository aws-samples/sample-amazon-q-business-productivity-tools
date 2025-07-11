// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import React from 'react';

interface HomeButtonProps {
  onClick: () => void;
  className?: string;
  label?: string;
}

/**
 * A reusable Home button component that navigates back to the tools landing page
 */
const HomeButton: React.FC<HomeButtonProps> = ({
  onClick,
  className = '',
  label = 'Back to Tools',
}) => {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-all flex items-center gap-2 ${className}`}
      aria-label={label}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
      {label}
    </button>
  );
};

export default HomeButton;
