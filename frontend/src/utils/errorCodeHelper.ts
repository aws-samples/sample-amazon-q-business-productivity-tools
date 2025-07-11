// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Helper to provide human-readable explanations for common Q Business error codes
 */

export interface ErrorCodeInfo {
  code: string;
  title: string;
  description: string;
  possibleCauses: string[];
  suggestedActions: string[];
}

const errorCodeMap: Record<string, ErrorCodeInfo> = {
  InternalError: {
    code: 'InternalError',
    title: 'Internal Service Error',
    description: 'An internal error occurred within the Q Business service',
    possibleCauses: [
      'Invalid document enrichment configuration',
      'Service temporarily unavailable',
      'Invalid document format or structure',
      'Configuration mismatch',
    ],
    suggestedActions: [
      'Verify document enrichment configuration',
      'Check if all required fields are present',
      'Retry the sync operation',
      'Review data source configuration',
    ],
  },
  ValidationException: {
    code: 'ValidationException',
    title: 'Validation Error',
    description: 'The document or request failed validation',
    possibleCauses: [
      'Missing required fields',
      'Invalid field values',
      'Document size exceeds limits',
      'Invalid characters in document',
    ],
    suggestedActions: [
      'Check document format and required fields',
      'Verify field values meet requirements',
      'Reduce document size if too large',
      'Remove invalid characters',
    ],
  },
  AccessDeniedException: {
    code: 'AccessDeniedException',
    title: 'Access Denied',
    description: 'Insufficient permissions to perform the operation',
    possibleCauses: [
      'IAM role missing required permissions',
      'Data source credentials expired',
      'Resource access restrictions',
    ],
    suggestedActions: [
      'Review IAM role permissions',
      'Update data source credentials',
      'Check resource access policies',
    ],
  },
  ResourceNotFoundException: {
    code: 'ResourceNotFoundException',
    title: 'Resource Not Found',
    description: 'The specified resource could not be found',
    possibleCauses: [
      'Document deleted from source',
      'Invalid document reference',
      'Resource moved or renamed',
    ],
    suggestedActions: [
      'Verify document exists in source',
      'Check document path/reference',
      'Update document mappings',
    ],
  },
  ThrottlingException: {
    code: 'ThrottlingException',
    title: 'Rate Limit Exceeded',
    description: 'Too many requests were made in a short period',
    possibleCauses: [
      'Sync job processing too many documents',
      'API rate limits reached',
      'Concurrent sync jobs running',
    ],
    suggestedActions: ['Reduce sync frequency', 'Implement batching', 'Stagger sync schedules'],
  },
};

export function getErrorCodeInfo(errorCode: string): ErrorCodeInfo | null {
  return errorCodeMap[errorCode] || null;
}

export function getCommonErrorCodes(): string[] {
  return Object.keys(errorCodeMap);
}

export function getErrorSeverity(errorCode: string): 'high' | 'medium' | 'low' {
  if (errorCode.includes('AccessDenied') || errorCode.includes('Unauthorized')) {
    return 'high';
  }
  if (errorCode.includes('Validation') || errorCode.includes('NotFound')) {
    return 'medium';
  }
  return 'low';
}

export function formatErrorMessage(errorMessage: string): string {
  // Extract key information from error messages
  const patterns = [
    { regex: /Service:\s*(\w+)/, label: 'Service' },
    { regex: /Status Code:\s*(\d+)/, label: 'Status' },
    { regex: /Request ID:\s*([\w-]+)/, label: 'Request ID' },
  ];

  let formatted = errorMessage;
  patterns.forEach(({ regex, label }) => {
    const match = errorMessage.match(regex);
    if (match) {
      formatted = formatted.replace(
        match[0],
        `
${label}: ${match[1]}`,
      );
    }
  });

  return formatted.trim();
}
