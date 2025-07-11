// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { EvaluationJobStatus } from '@aws-sdk/client-bedrock';
import { BarChart2, AlertTriangle } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';

import { bedrockProxyService } from '../../services/proxy/BedrockProxyService';
import { s3ProxyService } from '../../services/proxy/S3ProxyService';

interface EvaluationResult {
  prompt: string;
  groundTruth: string;
  response: string;
  status: 'pending' | 'completed' | 'error';
  error?: string;
}

interface EvaluateProps {
  evaluationResults: EvaluationResult[];
  isEvaluating: boolean;
  currentEvaluationIndex: number;
  evaluationComplete: boolean;
  fileData: { prompt: string; groundTruth: string }[];
  onContinue: () => void;
  setEvaluationJobId: React.Dispatch<React.SetStateAction<string>>;
  setOutputFolder: React.Dispatch<React.SetStateAction<string>>;
  s3BucketName: string;
  setS3BucketName: React.Dispatch<React.SetStateAction<string>>;
}

const Evaluate: React.FC<EvaluateProps> = ({
  evaluationResults,
  isEvaluating,
  currentEvaluationIndex,
  evaluationComplete,
  fileData,
  onContinue,
  setEvaluationJobId: parentSetEvaluationJobId,
  setOutputFolder,
  s3BucketName: parentS3BucketName,
  setS3BucketName: parentSetS3BucketName,
}) => {
  // S3 bucket state
  const [s3KeyPrefix, setS3KeyPrefix] = useState<string>('mbe-responses');

  // Evaluation job state
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Polling mechanism for job status
  useEffect(() => {
    // Clean up polling interval on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Function to start polling for job status
  const startPolling = (jobId: string) => {
    // Create a non-modal polling status indicator that doesn't block navigation
    const pollingStatusElement = document.createElement('div');
    pollingStatusElement.id = 'polling-status';
    pollingStatusElement.className = 'fixed bottom-4 right-4 z-40'; // Position in bottom-right corner

    // Create container div
    const containerDiv = document.createElement('div');
    containerDiv.className =
      'bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-lg max-w-md text-center';

    // Create flex container for title
    const flexContainer = document.createElement('div');
    flexContainer.className = 'flex items-center mb-2';

    // Create spinner
    const spinner = document.createElement('div');
    spinner.className =
      'animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500 mr-2';

    // Create title
    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold text-white';
    title.textContent = 'Evaluation in Progress';

    // Create status text
    const statusText = document.createElement('p');
    statusText.className = 'text-gray-300 text-sm mb-2';
    statusText.textContent = 'Polling Bedrock evaluation job status...';

    // Create progress bar container
    const progressBarContainer = document.createElement('div');
    progressBarContainer.className = 'h-2 w-full bg-gray-700 rounded-full overflow-hidden mb-2';

    // Create progress bar
    const progressBar = document.createElement('div');
    progressBar.className = 'h-full bg-blue-500 rounded-full animate-pulse';
    progressBar.style.width = '100%';

    // Create job ID text
    const jobIdText = document.createElement('p');
    jobIdText.className = 'text-gray-400 text-xs';
    jobIdText.textContent = `Job ID: ${jobId}`;

    // Create status display
    const statusDisplay = document.createElement('p');
    statusDisplay.className = 'text-gray-500 text-xs';
    statusDisplay.textContent = 'Status: Checking...';

    // Create navigation hint
    const navHint = document.createElement('p');
    navHint.className = 'text-blue-400 text-xs mt-2';
    navHint.textContent = 'You can navigate to the Results Tab while waiting';

    // Assemble the elements
    flexContainer.appendChild(spinner);
    flexContainer.appendChild(title);
    progressBarContainer.appendChild(progressBar);

    containerDiv.appendChild(flexContainer);
    containerDiv.appendChild(statusText);
    containerDiv.appendChild(progressBarContainer);
    containerDiv.appendChild(jobIdText);
    containerDiv.appendChild(statusDisplay);
    containerDiv.appendChild(navHint);

    pollingStatusElement.appendChild(containerDiv);
    document.body.appendChild(pollingStatusElement);

    // Set up polling interval (every 5 seconds)
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await bedrockProxyService.getEvaluationJobStatus(jobId);
        const status = response.success ? response.data.status || '' : '';

        // Update the polling status notification
        const statusElement = document.getElementById('polling-status');
        if (statusElement) {
          const statusDisplay = document.querySelector(
            '#polling-status p.text-gray-500.text-xs:last-child',
          );
          if (statusDisplay) {
            statusDisplay.textContent = `Status: ${status || 'Checking...'}`;
          }
        }

        // If job is completed, stop polling and navigate to results
        if (status === EvaluationJobStatus.COMPLETED) {
          stopPolling();

          // Show completion notification with Results tab redirection info
          const completionElement = document.createElement('div');
          completionElement.className =
            'fixed top-4 right-4 bg-green-900 text-white p-4 rounded-lg shadow-lg z-50 max-w-md';

          const flexContainer = document.createElement('div');
          flexContainer.className = 'flex items-start';

          // Create SVG icon
          const svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svgIcon.setAttribute('class', 'w-4 h-4 mr-2 mt-1 flex-shrink-0');
          svgIcon.setAttribute('fill', 'none');
          svgIcon.setAttribute('stroke', 'currentColor');
          svgIcon.setAttribute('viewBox', '0 0 24 24');

          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('stroke-linecap', 'round');
          path.setAttribute('stroke-linejoin', 'round');
          path.setAttribute('stroke-width', '2');
          path.setAttribute('d', 'M5 13l4 4L19 7');
          svgIcon.appendChild(path);

          // Create content container
          const contentDiv = document.createElement('div');

          // Create title
          const titleSpan = document.createElement('span');
          titleSpan.className = 'font-medium';
          titleSpan.textContent = 'Evaluation job completed successfully!';

          // Create message
          const messageP = document.createElement('p');
          messageP.className = 'text-sm mt-1';
          messageP.textContent = 'Redirecting to Results tab to view evaluation metrics...';

          // Assemble the elements
          contentDiv.appendChild(titleSpan);
          contentDiv.appendChild(messageP);

          flexContainer.appendChild(svgIcon);
          flexContainer.appendChild(contentDiv);

          completionElement.appendChild(flexContainer);
          document.body.appendChild(completionElement);

          // Remove the completion notification after 5 seconds
          setTimeout(() => {
            document.body.removeChild(completionElement);
          }, 5000);

          // Add a slight delay before navigating to results for better UX
          setTimeout(() => {
            // Navigate to results tab
            onContinue();
          }, 1500);
        }
      } catch (error) {
        console.error('Error polling job status:', error);

        // Update the polling status notification with error but maintain non-modal styling
        const statusElement = document.getElementById('polling-status');
        if (statusElement) {
          // Clear existing content
          while (statusElement.firstChild) {
            statusElement.removeChild(statusElement.firstChild);
          }

          // Create container
          const containerDiv = document.createElement('div');
          containerDiv.className =
            'bg-gray-900 border border-red-700 rounded-xl p-4 shadow-lg max-w-md text-center';

          // Create flex container for title
          const flexContainer = document.createElement('div');
          flexContainer.className = 'flex items-center mb-2 justify-center';

          // Create SVG icon
          const svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svgIcon.setAttribute('class', 'w-5 h-5 mr-2 text-red-500');
          svgIcon.setAttribute('fill', 'none');
          svgIcon.setAttribute('stroke', 'currentColor');
          svgIcon.setAttribute('viewBox', '0 0 24 24');

          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('stroke-linecap', 'round');
          path.setAttribute('stroke-linejoin', 'round');
          path.setAttribute('stroke-width', '2');
          path.setAttribute('d', 'M6 18L18 6M6 6l12 12');
          svgIcon.appendChild(path);

          // Create title
          const title = document.createElement('h3');
          title.className = 'text-lg font-semibold text-white';
          title.textContent = 'Error Polling Status';

          // Create error message
          const errorMsg = document.createElement('p');
          errorMsg.className = 'text-red-300 text-sm mb-2';
          errorMsg.textContent = error instanceof Error ? error.message : String(error);

          // Create navigation hint
          const navHint = document.createElement('p');
          navHint.className = 'text-blue-400 text-xs mt-2';
          navHint.textContent = 'You can still navigate to the Results Tab';

          // Assemble the elements
          flexContainer.appendChild(svgIcon);
          flexContainer.appendChild(title);

          containerDiv.appendChild(flexContainer);
          containerDiv.appendChild(errorMsg);
          containerDiv.appendChild(navHint);

          statusElement.appendChild(containerDiv);
        }

        // Stop polling on error
        stopPolling();
      }
    }, 5000); // Poll every 5 seconds for more responsive updates
  };

  // Function to stop polling
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    // Remove the polling status notification
    const statusElement = document.getElementById('polling-status');
    if (statusElement) {
      document.body.removeChild(statusElement);
    }
  };

  // Helper function to handle S3 upload and start evaluation
  const handleStartEvaluation = async () => {
    if (!parentS3BucketName) {
      alert('Please enter an S3 bucket name');
      return;
    }

    // Extract the randomString from the bucket name
    // Bucket name format is: mbe-eval-timestamp-randomString
    const bucketNameParts = parentS3BucketName.split('-');
    const randomString =
      bucketNameParts.length >= 4 ? bucketNameParts[3] : Math.random().toString(36).substring(2, 8);

    // Generate a key with the randomString
    const timestamp = new Date().toISOString().slice(0, 10);
    const key = `${s3KeyPrefix}-${timestamp}-${randomString}.jsonl`;

    // Get the MBE responses from localStorage
    const mbeResponsesString = localStorage.getItem('mbe-responses');
    if (!mbeResponsesString) {
      alert('No MBE responses found. Please generate responses first.');
      return;
    }

    // Show uploading state
    const uploadStatusElement = document.createElement('div');
    uploadStatusElement.className =
      'fixed top-4 right-4 bg-gray-900 text-white p-4 rounded-lg shadow-lg z-50';

    const flexContainer = document.createElement('div');
    flexContainer.className = 'flex items-center';

    const spinner = document.createElement('div');
    spinner.className =
      'animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500 mr-2';

    const statusText = document.createElement('span');
    statusText.textContent = 'Uploading to S3...';

    flexContainer.appendChild(spinner);
    flexContainer.appendChild(statusText);
    uploadStatusElement.appendChild(flexContainer);
    document.body.appendChild(uploadStatusElement);

    try {
      // The bucket should already exist since we checked/created it during evaluation
      // But we'll upload directly without checking again to avoid redundant operations
      console.log(`Uploading to S3 bucket: ${parentS3BucketName}, key: ${key}`);

      // Upload to S3 with improved error handling using proxy service
      const uploadResult = await s3ProxyService.uploadObject(
        parentS3BucketName,
        key,
        mbeResponsesString,
        'application/json',
      );

      if (!uploadResult.success) {
        throw new Error(uploadResult.error?.message || 'Upload failed');
      }

      // Remove the uploading status and show success
      document.body.removeChild(uploadStatusElement);

      const successElement = document.createElement('div');
      successElement.className =
        'fixed top-4 right-4 bg-green-900 text-white p-4 rounded-lg shadow-lg z-50';

      const successFlexContainer = document.createElement('div');
      successFlexContainer.className = 'flex items-center';

      // Create SVG icon
      const svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgIcon.setAttribute('class', 'w-4 h-4 mr-2');
      svgIcon.setAttribute('fill', 'none');
      svgIcon.setAttribute('stroke', 'currentColor');
      svgIcon.setAttribute('viewBox', '0 0 24 24');

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('d', 'M5 13l4 4L19 7');
      svgIcon.appendChild(path);

      // Create success message
      const successMessage = document.createElement('span');
      successMessage.textContent = `Successfully uploaded to s3://${parentS3BucketName}/${key}`;

      // Assemble the elements
      successFlexContainer.appendChild(svgIcon);
      successFlexContainer.appendChild(successMessage);
      successElement.appendChild(successFlexContainer);
      document.body.appendChild(successElement);

      // Log success for debugging
      console.log(`S3 upload successful: s3://${parentS3BucketName}/${key}`);

      // Generate a random output folder name
      const outputFolder = `output-${randomString}`;

      // Generate a random job name
      const jobName = `eval-job-${timestamp}-${randomString}`;

      // Show starting evaluation job status
      const evalStatusElement = document.createElement('div');
      evalStatusElement.className =
        'fixed top-4 right-4 bg-blue-900 text-white p-4 rounded-lg shadow-lg z-50';

      const evalFlexContainer = document.createElement('div');
      evalFlexContainer.className = 'flex items-center';

      const evalSpinner = document.createElement('div');
      evalSpinner.className =
        'animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500 mr-2';

      const evalStatusText = document.createElement('span');
      evalStatusText.textContent = 'Starting Bedrock evaluation job...';

      evalFlexContainer.appendChild(evalSpinner);
      evalFlexContainer.appendChild(evalStatusText);
      evalStatusElement.appendChild(evalFlexContainer);

      // Wait a bit before showing the next notification
      setTimeout(() => {
        document.body.removeChild(successElement);
        document.body.appendChild(evalStatusElement);

        // Call bedrockProxyService.startEvaluation
        bedrockProxyService
          .startEvaluation(parentS3BucketName, key, outputFolder, jobName)
          .then((response) => {
            // Remove the evaluation status
            document.body.removeChild(evalStatusElement);

            // Extract job ID from response
            const jobId = response.success
              ? response.data.jobId || response.data.evaluationJobId || response.data.jobArn || ''
              : '';

            // Set the job ID to start polling
            parentSetEvaluationJobId(jobId);

            // Set the output folder
            setOutputFolder(outputFolder);

            // Start polling for job status
            startPolling(jobId);

            // Show success message
            const evalSuccessElement = document.createElement('div');
            evalSuccessElement.className =
              'fixed top-4 right-4 bg-green-900 text-white p-4 rounded-lg shadow-lg z-50 max-w-md';

            const successFlexContainer = document.createElement('div');
            successFlexContainer.className = 'flex items-start';

            // Create SVG icon
            const successSvgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            successSvgIcon.setAttribute('class', 'w-4 h-4 mr-2 mt-1 flex-shrink-0');
            successSvgIcon.setAttribute('fill', 'none');
            successSvgIcon.setAttribute('stroke', 'currentColor');
            successSvgIcon.setAttribute('viewBox', '0 0 24 24');

            const successPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            successPath.setAttribute('stroke-linecap', 'round');
            successPath.setAttribute('stroke-linejoin', 'round');
            successPath.setAttribute('stroke-width', '2');
            successPath.setAttribute('d', 'M5 13l4 4L19 7');
            successSvgIcon.appendChild(successPath);

            // Create content container
            const successContentDiv = document.createElement('div');

            // Create title
            const successTitleSpan = document.createElement('span');
            successTitleSpan.className = 'font-medium';
            successTitleSpan.textContent = 'Evaluation job started successfully!';

            // Create job details
            const jobIdP = document.createElement('p');
            jobIdP.className = 'text-sm mt-1';
            jobIdP.textContent = `Job ID: ${jobId}`;

            const jobNameP = document.createElement('p');
            jobNameP.className = 'text-sm';
            jobNameP.textContent = `Job Name: ${jobName}`;

            const outputP = document.createElement('p');
            outputP.className = 'text-sm';
            outputP.textContent = `Output will be saved to: s3://${parentS3BucketName}/${outputFolder}`;

            const redirectP = document.createElement('p');
            redirectP.className = 'text-sm mt-2';
            redirectP.textContent = 'Redirecting to Results tab to monitor progress...';

            // Assemble the elements
            successContentDiv.appendChild(successTitleSpan);
            successContentDiv.appendChild(jobIdP);
            successContentDiv.appendChild(jobNameP);
            successContentDiv.appendChild(outputP);
            successContentDiv.appendChild(redirectP);

            successFlexContainer.appendChild(successSvgIcon);
            successFlexContainer.appendChild(successContentDiv);

            evalSuccessElement.appendChild(successFlexContainer);
            document.body.appendChild(evalSuccessElement);

            // Remove the success message after 5 seconds
            setTimeout(() => {
              document.body.removeChild(evalSuccessElement);
            }, 5000);

            // Navigate to results tab immediately
            setTimeout(() => {
              onContinue();
            }, 1000);
          })
          .catch((error) => {
            // Remove the evaluation status
            document.body.removeChild(evalStatusElement);

            // Show error message
            const evalErrorElement = document.createElement('div');
            evalErrorElement.className =
              'fixed top-4 right-4 bg-red-900 text-white p-4 rounded-lg shadow-lg z-50 max-w-md';

            const errorFlexContainer = document.createElement('div');
            errorFlexContainer.className = 'flex items-start';

            // Create SVG icon
            const errorSvgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            errorSvgIcon.setAttribute('class', 'w-4 h-4 mr-2 mt-1 flex-shrink-0');
            errorSvgIcon.setAttribute('fill', 'none');
            errorSvgIcon.setAttribute('stroke', 'currentColor');
            errorSvgIcon.setAttribute('viewBox', '0 0 24 24');

            const errorPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            errorPath.setAttribute('stroke-linecap', 'round');
            errorPath.setAttribute('stroke-linejoin', 'round');
            errorPath.setAttribute('stroke-width', '2');
            errorPath.setAttribute('d', 'M6 18L18 6M6 6l12 12');
            errorSvgIcon.appendChild(errorPath);

            // Create content container
            const errorContentDiv = document.createElement('div');

            // Create title
            const errorTitleSpan = document.createElement('span');
            errorTitleSpan.className = 'font-medium';
            errorTitleSpan.textContent = 'Failed to start evaluation job';

            // Create error message
            const errorMessageP = document.createElement('p');
            errorMessageP.className = 'text-sm mt-1';
            errorMessageP.textContent = error instanceof Error ? error.message : String(error);

            // Assemble the elements
            errorContentDiv.appendChild(errorTitleSpan);
            errorContentDiv.appendChild(errorMessageP);

            errorFlexContainer.appendChild(errorSvgIcon);
            errorFlexContainer.appendChild(errorContentDiv);

            evalErrorElement.appendChild(errorFlexContainer);
            document.body.appendChild(evalErrorElement);

            // Remove the error message after 10 seconds
            setTimeout(() => {
              document.body.removeChild(evalErrorElement);
            }, 10000);
          });
      }, 1000);
    } catch (error) {
      // Remove the status elements
      if (document.body.contains(uploadStatusElement)) {
        document.body.removeChild(uploadStatusElement);
      }

      console.error('Error with S3 upload:', error);

      // Create a more detailed error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      let troubleshootingTips = '';

      if (errorMessage.includes('CORS')) {
        troubleshootingTips = `
                    <div class="mt-2 text-xs">
                        <p>Troubleshooting tips:</p>
                        <ul class="list-disc pl-4 mt-1">
                            <li>Ensure your S3 bucket has proper CORS configuration</li>
                            <li>Check that your IAM user has s3:PutObject permissions</li>
                            <li>Try using a different browser</li>
                        </ul>
                    </div>
                `;
      } else if (errorMessage.includes('AccessDenied')) {
        troubleshootingTips = `
                    <div class="mt-2 text-xs">
                        <p>Troubleshooting tips:</p>
                        <ul class="list-disc pl-4 mt-1">
                            <li>Check your IAM permissions (need s3:PutObject)</li>
                            <li>Verify your AWS credentials are correct</li>
                            <li>Ensure the bucket policy allows uploads</li>
                        </ul>
                    </div>
                `;
      } else if (errorMessage.includes('NoSuchBucket')) {
        // If bucket doesn't exist (which shouldn't happen since we created it earlier),
        // try to create it now
        troubleshootingTips = `
                    <div class="mt-2 text-xs">
                        <p>The bucket doesn't exist. Trying to create it now...</p>
                    </div>
                `;

        // Show this error briefly, then try to create the bucket
        const tempErrorElement = document.createElement('div');
        tempErrorElement.className =
          'fixed top-4 right-4 bg-yellow-900 text-white p-4 rounded-lg shadow-lg z-50';

        const tempFlexContainer = document.createElement('div');
        tempFlexContainer.className = 'flex items-center';

        // Create SVG icon
        const tempSvgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvgIcon.setAttribute('class', 'w-4 h-4 mr-2');
        tempSvgIcon.setAttribute('fill', 'none');
        tempSvgIcon.setAttribute('stroke', 'currentColor');
        tempSvgIcon.setAttribute('viewBox', '0 0 24 24');

        const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tempPath.setAttribute('stroke-linecap', 'round');
        tempPath.setAttribute('stroke-linejoin', 'round');
        tempPath.setAttribute('stroke-width', '2');
        tempPath.setAttribute(
          'd',
          'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
        );
        tempSvgIcon.appendChild(tempPath);

        // Create message
        const tempMessage = document.createElement('span');
        tempMessage.textContent = 'Bucket not found. Attempting to create it...';

        // Assemble the elements
        tempFlexContainer.appendChild(tempSvgIcon);
        tempFlexContainer.appendChild(tempMessage);
        tempErrorElement.appendChild(tempFlexContainer);
        document.body.appendChild(tempErrorElement);

        // Try to create the bucket after a short delay
        setTimeout(async () => {
          try {
            document.body.removeChild(tempErrorElement);

            // Use default region
            const region = 'us-east-1';

            // Create the bucket and set CORS policy using proxy service
            const bucketResult = await s3ProxyService.ensureBucketExists(
              parentS3BucketName,
              region,
            );

            if (!bucketResult.success) {
              throw new Error(bucketResult.error?.message || 'Failed to ensure bucket exists');
            }

            // Try the upload again
            const retryElement = document.createElement('div');
            retryElement.className =
              'fixed top-4 right-4 bg-blue-900 text-white p-4 rounded-lg shadow-lg z-50';

            const retryFlexContainer = document.createElement('div');
            retryFlexContainer.className = 'flex items-center';

            const retrySpinner = document.createElement('div');
            retrySpinner.className =
              'animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500 mr-2';

            const retryText = document.createElement('span');
            retryText.textContent = 'Retrying upload...';

            retryFlexContainer.appendChild(retrySpinner);
            retryFlexContainer.appendChild(retryText);
            retryElement.appendChild(retryFlexContainer);
            document.body.appendChild(retryElement);

            // Try the upload again using proxy service
            const retryUploadResult = await s3ProxyService.uploadObject(
              parentS3BucketName,
              key,
              mbeResponsesString,
              'application/json',
            );

            if (!retryUploadResult.success) {
              throw new Error(retryUploadResult.error?.message || 'Retry upload failed');
            }

            // Show success
            document.body.removeChild(retryElement);
            const successElement = document.createElement('div');
            successElement.className =
              'fixed top-4 right-4 bg-green-900 text-white p-4 rounded-lg shadow-lg z-50';

            const retrySuccessFlexContainer = document.createElement('div');
            retrySuccessFlexContainer.className = 'flex items-center';

            // Create SVG icon
            const retrySuccessSvgIcon = document.createElementNS(
              'http://www.w3.org/2000/svg',
              'svg',
            );
            retrySuccessSvgIcon.setAttribute('class', 'w-4 h-4 mr-2');
            retrySuccessSvgIcon.setAttribute('fill', 'none');
            retrySuccessSvgIcon.setAttribute('stroke', 'currentColor');
            retrySuccessSvgIcon.setAttribute('viewBox', '0 0 24 24');

            const retrySuccessPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            retrySuccessPath.setAttribute('stroke-linecap', 'round');
            retrySuccessPath.setAttribute('stroke-linejoin', 'round');
            retrySuccessPath.setAttribute('stroke-width', '2');
            retrySuccessPath.setAttribute('d', 'M5 13l4 4L19 7');
            retrySuccessSvgIcon.appendChild(retrySuccessPath);

            const retrySuccessText = document.createElement('span');
            retrySuccessText.textContent = `Successfully uploaded to s3://${parentS3BucketName}/${key}`;

            retrySuccessFlexContainer.appendChild(retrySuccessSvgIcon);
            retrySuccessFlexContainer.appendChild(retrySuccessText);
            successElement.appendChild(retrySuccessFlexContainer);
            document.body.appendChild(successElement);

            // Remove after 5 seconds
            setTimeout(() => {
              document.body.removeChild(successElement);
            }, 5000);
          } catch (retryError) {
            // If retry fails, show the final error
            const finalErrorElement = document.createElement('div');
            finalErrorElement.className =
              'fixed top-4 right-4 bg-red-900 text-white p-4 rounded-lg shadow-lg z-50 max-w-md';

            const finalErrorFlexContainer = document.createElement('div');
            finalErrorFlexContainer.className = 'flex items-start';

            // Create SVG icon
            const finalErrorSvgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            finalErrorSvgIcon.setAttribute('class', 'w-4 h-4 mr-2 mt-1 flex-shrink-0');
            finalErrorSvgIcon.setAttribute('fill', 'none');
            finalErrorSvgIcon.setAttribute('stroke', 'currentColor');
            finalErrorSvgIcon.setAttribute('viewBox', '0 0 24 24');

            const finalErrorPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            finalErrorPath.setAttribute('stroke-linecap', 'round');
            finalErrorPath.setAttribute('stroke-linejoin', 'round');
            finalErrorPath.setAttribute('stroke-width', '2');
            finalErrorPath.setAttribute('d', 'M6 18L18 6M6 6l12 12');
            finalErrorSvgIcon.appendChild(finalErrorPath);

            // Create content container
            const finalErrorContentDiv = document.createElement('div');

            // Create title
            const finalErrorTitleSpan = document.createElement('span');
            finalErrorTitleSpan.className = 'font-medium';
            finalErrorTitleSpan.textContent = 'Error with S3 operation:';

            // Create error message
            const finalErrorMessageP = document.createElement('p');
            finalErrorMessageP.className = 'text-sm mt-1';
            finalErrorMessageP.textContent =
              retryError instanceof Error
                ? retryError.message
                : 'Failed to create bucket and retry upload';

            // Assemble the elements
            finalErrorContentDiv.appendChild(finalErrorTitleSpan);
            finalErrorContentDiv.appendChild(finalErrorMessageP);

            finalErrorFlexContainer.appendChild(finalErrorSvgIcon);
            finalErrorFlexContainer.appendChild(finalErrorContentDiv);

            finalErrorElement.appendChild(finalErrorFlexContainer);
            document.body.appendChild(finalErrorElement);

            // Remove after 15 seconds
            setTimeout(() => {
              document.body.removeChild(finalErrorElement);
            }, 15000);
          }
        }, 2000);

        // Don't show the regular error element in this case
        return;
      }

      const errorElement = document.createElement('div');
      errorElement.className =
        'fixed top-4 right-4 bg-red-900 text-white p-4 rounded-lg shadow-lg z-50 max-w-md';

      const errorFlexContainer = document.createElement('div');
      errorFlexContainer.className = 'flex items-start';

      // Create SVG icon
      const errorSvgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      errorSvgIcon.setAttribute('class', 'w-4 h-4 mr-2 mt-1 flex-shrink-0');
      errorSvgIcon.setAttribute('fill', 'none');
      errorSvgIcon.setAttribute('stroke', 'currentColor');
      errorSvgIcon.setAttribute('viewBox', '0 0 24 24');

      const errorPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      errorPath.setAttribute('stroke-linecap', 'round');
      errorPath.setAttribute('stroke-linejoin', 'round');
      errorPath.setAttribute('stroke-width', '2');
      errorPath.setAttribute('d', 'M6 18L18 6M6 6l12 12');
      errorSvgIcon.appendChild(errorPath);

      // Create content container
      const errorContentDiv = document.createElement('div');

      // Create title
      const errorTitleSpan = document.createElement('span');
      errorTitleSpan.className = 'font-medium';
      errorTitleSpan.textContent = 'Error with S3 upload:';

      // Create error message
      const errorMessageP = document.createElement('p');
      errorMessageP.className = 'text-sm mt-1';
      errorMessageP.textContent = errorMessage;

      // Assemble the elements
      errorContentDiv.appendChild(errorTitleSpan);
      errorContentDiv.appendChild(errorMessageP);

      // Handle troubleshooting tips
      if (
        troubleshootingTips.includes('CORS') ||
        troubleshootingTips.includes('AccessDenied') ||
        troubleshootingTips.includes('NoSuchBucket')
      ) {
        // Create troubleshooting container
        const tipsDiv = document.createElement('div');
        tipsDiv.className = 'mt-2 text-xs';

        const tipsTitle = document.createElement('p');
        tipsTitle.textContent = 'Troubleshooting tips:';

        const tipsList = document.createElement('ul');
        tipsList.className = 'list-disc pl-4 mt-1';

        // Add appropriate tips based on error type
        if (errorMessage.includes('CORS')) {
          const tip1 = document.createElement('li');
          tip1.textContent = 'Ensure your S3 bucket has proper CORS configuration';

          const tip2 = document.createElement('li');
          tip2.textContent = 'Check that your IAM user has s3:PutObject permissions';

          const tip3 = document.createElement('li');
          tip3.textContent = 'Try using a different browser';

          tipsList.appendChild(tip1);
          tipsList.appendChild(tip2);
          tipsList.appendChild(tip3);
        } else if (errorMessage.includes('AccessDenied')) {
          const tip1 = document.createElement('li');
          tip1.textContent = 'Check your IAM permissions (need s3:PutObject)';

          const tip2 = document.createElement('li');
          tip2.textContent = 'Verify your AWS credentials are correct';

          const tip3 = document.createElement('li');
          tip3.textContent = 'Ensure the bucket policy allows uploads';

          tipsList.appendChild(tip1);
          tipsList.appendChild(tip2);
          tipsList.appendChild(tip3);
        } else if (errorMessage.includes('NoSuchBucket')) {
          const tip = document.createElement('p');
          tip.textContent = "The bucket doesn't exist. Trying to create it now...";
          tipsDiv.appendChild(tip);
        }

        if (!errorMessage.includes('NoSuchBucket')) {
          tipsDiv.appendChild(tipsTitle);
          tipsDiv.appendChild(tipsList);
        }

        errorContentDiv.appendChild(tipsDiv);
      }

      errorFlexContainer.appendChild(errorSvgIcon);
      errorFlexContainer.appendChild(errorContentDiv);

      errorElement.appendChild(errorFlexContainer);
      document.body.appendChild(errorElement);

      // Remove the error message after 15 seconds
      setTimeout(() => {
        document.body.removeChild(errorElement);
      }, 15000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-gray-900/50 backdrop-blur-lg rounded-2xl p-8 border border-gray-800 mb-8">
        <h2 className="text-xl font-semibold mb-6 text-gray-200">Evaluate Q Business Responses</h2>

        {/* S3 Configuration */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">CONFIGURE S3</h3>
          <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700 mb-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">S3 Bucket Name</label>
              <input
                type="text"
                className="block w-full px-4 py-3 bg-gray-900/50 backdrop-blur-lg border border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white"
                value={parentS3BucketName}
                onChange={(e) => parentSetS3BucketName(e.target.value)}
                placeholder="Enter S3 bucket name"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the name of an S3 bucket in your account
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">S3 Key Prefix</label>
              <input
                type="text"
                className="block w-full px-4 py-3 bg-gray-900/50 backdrop-blur-lg border border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white"
                value={s3KeyPrefix}
                onChange={(e) => setS3KeyPrefix(e.target.value)}
                placeholder="Enter S3 key prefix"
              />
              <p className="text-xs text-gray-500 mt-1">
                The prefix for S3 keys (e.g., 'mbe-responses')
              </p>
            </div>
          </div>
        </div>
        {/* Q Business Response Summary */}
        {evaluationResults.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">
              Q BUSINESS RESPONSES SUMMARY
            </h3>
            <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-800/50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-white">{evaluationResults.length}</div>
                  <div className="text-xs text-gray-400">Total Prompts</div>
                </div>
                <div className="bg-gray-800/50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {evaluationResults.filter((r) => r.status === 'completed').length}
                  </div>
                  <div className="text-xs text-gray-400">Completed</div>
                </div>
                <div className="bg-gray-800/50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-red-400">
                    {evaluationResults.filter((r) => r.status === 'error').length}
                  </div>
                  <div className="text-xs text-gray-400">Errors</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Start Evaluation Button */}
        <div className="mb-6">
          <div className="flex justify-end">
            <button
              className={`px-6 py-3 bg-gradient-to-r from-green-500 to-teal-500 rounded-xl text-white font-medium hover:from-green-600 hover:to-teal-600 transition-all flex items-center ${!evaluationComplete ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!evaluationComplete}
              onClick={handleStartEvaluation}
            >
              <BarChart2 className="h-4 w-4 mr-2" />
              Start Evaluation
            </button>
          </div>
        </div>
      </div>

      {/* Placeholder when no evaluation results */}
      {evaluationResults.length === 0 && (
        <div className="bg-gray-900/50 backdrop-blur-lg rounded-2xl p-8 border border-gray-800 text-center">
          <BarChart2 className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-300 mb-2">No Evaluation Results</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            Upload data and generate responses first to see evaluation results here.
          </p>
        </div>
      )}
    </div>
  );
};

export default Evaluate;
