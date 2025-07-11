// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { GetEvaluationJobCommandOutput } from '@aws-sdk/client-bedrock';
import {
  BarChart2,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  Loader,
  Info,
  Download,
} from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

import { EvaluationJobSummary } from '../../services/BedrockService';
import { bedrockProxyService } from '../../services/proxy/BedrockProxyService';
import { s3ProxyService } from '../../services/proxy/S3ProxyService';

interface PreviousEvaluationsProps {
  onSelectJob: (jobId: string, outputLocation?: string) => void;
  currentJobId?: string;
}

interface EvaluationMetric {
  name: string;
  score: number;
  category: string;
}

interface EvaluationJobDetails {
  jobId: string;
  jobName: string;
  status: string;
  createdAt: Date;
  lastModifiedAt?: Date;
  metrics?: EvaluationMetric[];
  outputLocation?: string;
  rawDetails?: GetEvaluationJobCommandOutput;
  evaluationResults?: any[]; // Detailed evaluation results from S3
}

const PreviousEvaluations: React.FC<PreviousEvaluationsProps> = ({ onSelectJob, currentJobId }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<EvaluationJobSummary[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [jobDetails, setJobDetails] = useState<EvaluationJobDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  // Fetch evaluation jobs list
  const fetchJobs = useCallback(async (token?: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await bedrockProxyService.listEvaluationJobs(20, token);

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch evaluation jobs');
      }

      const responseData = response.data;
      // Since we're not sure about the exact structure of the response,
      // let's use a type assertion to access the data
      const jobsList = responseData.jobSummaries!;

      if (jobsList.length > 0) {
        // Transform the API response into our EvaluationJobSummary format
        const jobSummaries: EvaluationJobSummary[] = jobsList.map((job: any) => ({
          jobId: job.jobArn || '',
          jobName: job.jobName || 'Unnamed Job',
          status: job.status || 'UNKNOWN',
          createdAt: job.creationTime ? new Date(job.creationTime) : new Date(),
          lastModifiedAt: job.lastModifiedTime ? new Date(job.lastModifiedTime) : undefined,
          outputLocation: job.outputDataConfig?.s3Uri,
        }));

        setJobs((prevJobs) => (token ? [...prevJobs, ...jobSummaries] : jobSummaries));
      } else {
        setJobs([]);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching evaluation jobs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch evaluation jobs');
      setLoading(false);
    }
  }, []);

  // Initial fetch of jobs list
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Fetch job details when a job is selected
  const fetchJobDetails = async (jobId: string) => {
    try {
      setLoadingDetails(true);
      setError(null);
      const result = await bedrockProxyService.getEvaluationJobStatus(jobId);

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch job details');
      }

      const response = result.data;

      // Find the job in our list to get additional info
      const jobSummary = jobs.find((job) => job.jobId === jobId);

      if (response && jobSummary) {
        // Extract metrics if available
        const metrics: EvaluationMetric[] = [];

        // If there are evaluation results in the response, extract metrics
        // Using type assertion since the TypeScript definitions might not include all properties
        const responseAny = response as any;
        if (responseAny.evaluationResults) {
          Object.entries(responseAny.evaluationResults).forEach(
            ([datasetName, datasetResults]: [string, any]) => {
              if (datasetResults.metricResults) {
                Object.entries(datasetResults.metricResults).forEach(
                  ([metricName, metricValue]: [string, any]) => {
                    // Extract category from metric name (e.g., Builtin.Helpfulness -> Helpfulness)
                    const category = metricName.includes('.')
                      ? metricName.split('.')[1]
                      : metricName;

                    metrics.push({
                      name: metricName,
                      score:
                        typeof metricValue === 'number'
                          ? metricValue
                          : metricValue.score !== undefined
                            ? metricValue.score
                            : 0,
                      category,
                    });
                  },
                );
              }
            },
          );
        }

        const jobDetailsObj = {
          jobId,
          jobName: jobSummary.jobName,
          status: response.status || jobSummary.status,
          createdAt: jobSummary.createdAt,
          lastModifiedAt: response.lastModifiedTime
            ? new Date(response.lastModifiedTime)
            : jobSummary.lastModifiedAt,
          metrics,
          outputLocation: response.outputDataConfig?.s3Uri,
          rawDetails: response,
        };

        // Set job details first so we have basic information available
        setJobDetails(jobDetailsObj);

        // If job is completed and has an output location, fetch the detailed results from S3
        if (jobDetailsObj.status === 'COMPLETED' && jobDetailsObj.outputLocation) {
          fetchS3EvaluationResults(jobDetailsObj);
        }
      } else {
        setError('Failed to fetch job details');
      }

      setLoadingDetails(false);
    } catch (err) {
      console.error('Error fetching job details:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch job details');
      setLoadingDetails(false);
    }
  };

  // Fetch detailed evaluation results from S3
  const fetchS3EvaluationResults = async (jobDetailsObj: EvaluationJobDetails) => {
    try {
      if (!jobDetailsObj.outputLocation) {
        throw new Error('No output location found in job details');
      }

      // Parse S3 URI to get bucket and key
      const s3UriMatch = jobDetailsObj.outputLocation.match(/s3:\/\/([^/]+)\/(.+)/);
      if (!s3UriMatch) {
        throw new Error('Invalid S3 URI format');
      }

      const [, bucket, keyPrefix] = s3UriMatch;

      // Find JSONL files recursively in the bucket
      const jsonlFile = await findJsonlFileRecursively(bucket, keyPrefix);

      if (!jsonlFile) {
        throw new Error('No JSONL file found in the output location or its subdirectories');
      }

      // Get the file content using getObject2 which returns parsed JSON
      const result = await s3ProxyService.getObject2(bucket, jsonlFile);

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to fetch result file content');
      }

      const evaluationResults = result.data;

      if (
        !evaluationResults ||
        (Array.isArray(evaluationResults) && evaluationResults.length === 0)
      ) {
        throw new Error('Failed to fetch result file content or empty results');
      }

      // Update job details with the evaluation results
      setJobDetails({
        ...jobDetailsObj,
        evaluationResults: Array.isArray(evaluationResults)
          ? evaluationResults
          : [evaluationResults],
      });
    } catch (err) {
      console.error('Error fetching S3 evaluation results:', err);
      // Don't set the error state here, as we still want to show the job details
      // Just log the error and continue
    }
  };

  // Define an interface for S3 objects
  interface S3Object {
    key: string;
    [key: string]: any; // Allow other properties
  }

  // Helper function to recursively search for JSONL files in S3
  const findJsonlFileRecursively = async (
    bucket: string,
    prefix: string,
  ): Promise<string | null> => {
    try {
      // List objects with the current prefix
      const listResult = await s3ProxyService.listObjects(bucket, prefix);

      if (!listResult.success || !listResult.data) {
        console.error('Error listing objects:', listResult.error?.message);
        return null;
      }

      const objects: S3Object[] = listResult.data;

      if (!objects || objects.length === 0) {
        return null;
      }

      // First, look for JSONL files directly
      const jsonlFiles = objects.filter((obj) => obj.key?.endsWith('.jsonl'));

      if (jsonlFiles.length > 0) {
        return jsonlFiles[0].key;
      }

      // If no JSONL files found, look for JSON files as fallback
      const jsonFiles = objects.filter(
        (obj) => obj.key?.endsWith('.json') || obj.key?.includes('evaluation_results'),
      );

      if (jsonFiles.length > 0) {
        return jsonFiles[0].key;
      }

      // If no direct matches, check for directories (objects ending with /)
      // and search recursively in each directory
      const directories = objects.filter((obj) => obj.key?.endsWith('/') && obj.key !== prefix);

      for (const dir of directories) {
        const dirResult = await findJsonlFileRecursively(bucket, dir.key);
        if (dirResult) {
          return dirResult;
        }
      }

      // If no directories or no results in directories, check all objects that might be directories
      // (S3 doesn't have a concept of directories, but we can infer them from object keys)
      const potentialDirs = objects
        .filter((obj) => !obj.key?.endsWith('/') && obj.key !== prefix)
        .map((obj) => {
          const parts = obj.key.split('/');
          if (parts.length > 1) {
            // Remove the last part (file name) and add trailing slash
            parts.pop();
            return parts.join('/') + '/';
          }
          return null;
        })
        .filter((dir): dir is string => dir !== null)
        // Remove duplicates
        .filter((dir, index, self) => self.indexOf(dir) === index);

      for (const dir of potentialDirs) {
        const dirResult = await findJsonlFileRecursively(bucket, dir);
        if (dirResult) {
          return dirResult;
        }
      }

      return null;
    } catch (err) {
      console.error('Error searching for JSONL files:', err);
      return null;
    }
  };

  // Handle job selection
  const handleSelectJob = (jobId: string) => {
    if (selectedJob === jobId) {
      // If clicking the same job, deselect it
      setSelectedJob(null);
      setJobDetails(null);
    } else {
      // Select the job and fetch its details
      setSelectedJob(jobId);
      fetchJobDetails(jobId);
    }
  };

  // Function to download the S3 file from outputDataConfig
  const downloadOutputFile = async (jobId: string) => {
    try {
      setLoadingDetails(true);
      setError(null);

      // Get the job details to access the outputDataConfig
      const jobResult = await bedrockProxyService.getEvaluationJobStatus(jobId);

      if (!jobResult.success) {
        throw new Error(jobResult.error?.message || 'Failed to fetch job details');
      }

      const response = jobResult.data;

      if (!response || !response.outputDataConfig || !response.outputDataConfig.s3Uri) {
        throw new Error('No output location found in job details');
      }

      // Parse S3 URI to get bucket and key
      const s3UriMatch = response.outputDataConfig.s3Uri.match(/s3:\/\/([^/]+)\/(.+)/);
      if (!s3UriMatch) {
        throw new Error('Invalid S3 URI format');
      }

      const [, bucket, keyPrefix] = s3UriMatch;

      // Find JSONL files recursively in the bucket
      const jsonlFile = await findJsonlFileRecursively(bucket, keyPrefix);

      if (!jsonlFile) {
        throw new Error('No JSONL file found in the output location or its subdirectories');
      }

      // Get the file content using getObject2 which returns parsed JSON
      const s3Result = await s3ProxyService.getObject2(bucket, jsonlFile);

      if (!s3Result.success || !s3Result.data) {
        throw new Error(s3Result.error?.message || 'Failed to fetch result file content');
      }

      const evaluationResults = s3Result.data;

      if (!evaluationResults) {
        throw new Error('Failed to fetch result file content');
      }

      // Convert the JSON object back to a string for download
      const jsonString = JSON.stringify(evaluationResults, null, 2);

      // Create a blob and download it
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `evaluation-results-${jobId}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setLoadingDetails(false);
    } catch (err) {
      console.error('Error downloading results:', err);
      setError(err instanceof Error ? err.message : 'Failed to download evaluation results');
      setLoadingDetails(false);
    }
  };

  // Handle refresh of job list
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchJobs();
    setSelectedJob(null);
    setJobDetails(null);
    setRefreshing(false);
  };

  // Helper function to format date
  const formatDate = (date: Date): string => {
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Helper function to get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'FAILED':
        return <XCircle className="h-5 w-5 text-red-400" />;
      case 'IN_PROGRESS':
      case 'STARTING':
        return <Loader className="h-5 w-5 text-yellow-400 animate-spin" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  // Helper function to get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-400';
      case 'FAILED':
        return 'text-red-400';
      case 'IN_PROGRESS':
      case 'STARTING':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  // Group metrics by category
  const groupedMetrics =
    jobDetails?.metrics?.reduce(
      (acc, metric) => {
        if (!acc[metric.category]) {
          acc[metric.category] = [];
        }
        acc[metric.category].push(metric);
        return acc;
      },
      {} as Record<string, EvaluationMetric[]>,
    ) || {};

  // Helper function to get color based on metric score
  const getMetricColor = (score: number): string => {
    if (score >= 0.8) return 'text-green-400';
    if (score >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-800 mb-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-200 flex items-center">
          <BarChart2 className="h-5 w-5 mr-2 text-purple-400" />
          Previous Evaluations
        </h3>
        <button
          onClick={handleRefresh}
          className={`p-2 rounded-full hover:bg-gray-800 transition-all ${refreshing ? 'animate-spin' : ''}`}
          disabled={refreshing || loading}
          title="Refresh"
        >
          <RefreshCw className="h-5 w-5 text-gray-400" />
        </button>
      </div>

      {/* Job List */}
      {loading && !refreshing ? (
        <div className="text-center py-8">
          <Loader className="animate-spin h-8 w-8 text-purple-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading evaluation jobs...</p>
        </div>
      ) : error ? (
        <div className="bg-red-900/20 backdrop-blur-lg rounded-xl p-6 border border-red-900/50">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-400 mr-3 mt-0.5" />
            <div>
              <h3 className="text-lg font-medium text-red-400 mb-2">Error Loading Jobs</h3>
              <p className="text-gray-300">{error}</p>
              <button
                onClick={handleRefresh}
                className="mt-4 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all inline-flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </button>
            </div>
          </div>
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-8 border border-gray-800 rounded-xl bg-gray-800/20">
          <BarChart2 className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">No Evaluation Jobs Found</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            Start an evaluation job from the Evaluate tab to see it listed here.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-gray-800">
            <table className="min-w-full divide-y divide-gray-800">
              <thead className="bg-gray-800/50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                  >
                    Job Name
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                  >
                    Created
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                  >
                    Last Updated
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">View</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-900/30 divide-y divide-gray-800">
                {jobs.map((job) => (
                  <tr
                    key={job.jobId}
                    className={`hover:bg-gray-800/30 transition-colors cursor-pointer ${
                      job.jobId === currentJobId
                        ? 'bg-purple-900/20'
                        : job.jobId === selectedJob
                          ? 'bg-blue-900/20'
                          : ''
                    }`}
                    onClick={() => handleSelectJob(job.jobId)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(job.status)}
                        <span className={`ml-2 text-sm ${getStatusColor(job.status)}`}>
                          {job.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-white font-medium">{job.jobName}</div>
                      <div
                        className="text-xs text-gray-500 font-mono truncate max-w-[200px]"
                        title={job.jobId}
                      >
                        {job.jobId}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-300">
                        <Clock className="h-4 w-4 mr-2 text-gray-500" />
                        {formatDate(job.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex space-x-2 justify-end">
                        <button
                          onClick={() => onSelectJob(job.jobId, job.outputLocation)}
                          className={`inline-flex items-center px-3 py-1 rounded-md ${
                            job.jobId === currentJobId
                              ? 'bg-purple-500/20 text-purple-300'
                              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          {job.jobId === currentJobId ? 'Current' : 'View'}
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </button>
                        {job.status === 'COMPLETED' && job.outputLocation && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadOutputFile(job.jobId);
                            }}
                            className="inline-flex items-center px-3 py-1 rounded-md bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
                            title="Download evaluation results"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Job Details Section */}
      {selectedJob && (
        <div className="mt-8 border-t border-gray-800 pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-200 flex items-center">
              <Info className="h-5 w-5 mr-2 text-blue-400" />
              Evaluation Job Details
            </h3>
          </div>

          {loadingDetails ? (
            <div className="text-center py-6">
              <Loader className="animate-spin h-6 w-6 text-blue-500 mx-auto mb-3" />
              <p className="text-gray-400">Loading job details...</p>
            </div>
          ) : error ? (
            <div className="bg-red-900/20 backdrop-blur-lg rounded-xl p-4 border border-red-900/50">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-400 mr-3 mt-0.5" />
                <div>
                  <h3 className="text-lg font-medium text-red-400 mb-2">Error Loading Details</h3>
                  <p className="text-gray-300">{error}</p>
                </div>
              </div>
            </div>
          ) : jobDetails ? (
            <div>
              {/* Job Summary */}
              <div className="mb-6 p-4 bg-gray-800/30 rounded-xl border border-gray-700">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Job Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Job Name</p>
                    <p className="text-white">{jobDetails.jobName}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Status</p>
                    <p className={`font-medium ${getStatusColor(jobDetails.status)}`}>
                      {jobDetails.status}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Created At</p>
                    <p className="text-white">{formatDate(jobDetails.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Last Updated</p>
                    <p className="text-white">
                      {jobDetails.lastModifiedAt ? formatDate(jobDetails.lastModifiedAt) : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Metrics Section - Only show if job is completed and has metrics */}
              {jobDetails.status === 'COMPLETED' && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">EVALUATION METRICS</h3>

                  {/* Overall metrics from Bedrock */}
                  {jobDetails.metrics && jobDetails.metrics.length > 0 && (
                    <div className="space-y-6 mb-6">
                      <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700">
                        <h4 className="text-sm font-medium text-gray-300 mb-3">Overall Metrics</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {Object.entries(groupedMetrics).map(([category, metrics]) => (
                            <div key={category} className="bg-gray-800/50 p-3 rounded-lg">
                              <h5 className="text-sm font-medium text-gray-300 mb-2">{category}</h5>
                              {metrics.map((metric) => (
                                <div key={metric.name} className="mb-3">
                                  <div className="flex justify-between items-center">
                                    <div className="text-sm text-gray-400">
                                      {metric.name.split('.').pop()}
                                    </div>
                                    <div
                                      className={`text-lg font-bold ${getMetricColor(metric.score)}`}
                                    >
                                      {(metric.score * 100).toFixed(1)}%
                                    </div>
                                  </div>
                                  <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        metric.score >= 0.8
                                          ? 'bg-green-500'
                                          : metric.score >= 0.6
                                            ? 'bg-yellow-500'
                                            : 'bg-red-500'
                                      }`}
                                      style={{ width: `${metric.score * 100}%` }}
                                    ></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Detailed metrics from S3 JSONL file */}
                  {jobDetails.evaluationResults && jobDetails.evaluationResults.length > 0 && (
                    <div className="space-y-6">
                      {/* Summary metrics visualization */}
                      <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700">
                        <h4 className="text-sm font-medium text-gray-300 mb-3">
                          Evaluation Summary
                        </h4>

                        {/* Calculate average scores across all results */}
                        {(() => {
                          // Collect all metrics from all results
                          const allMetrics: Record<string, number[]> = {};

                          jobDetails.evaluationResults.forEach((result) => {
                            if (result.metrics && Object.keys(result.metrics).length > 0) {
                              Object.entries(result.metrics).forEach(
                                ([metricName, metricValue]: [string, any]) => {
                                  const score =
                                    typeof metricValue === 'number'
                                      ? metricValue
                                      : metricValue.score !== undefined
                                        ? metricValue.score
                                        : 0;

                                  if (!allMetrics[metricName]) {
                                    allMetrics[metricName] = [];
                                  }
                                  allMetrics[metricName].push(score);
                                },
                              );
                            }
                          });

                          // Calculate averages
                          const averageMetrics = Object.entries(allMetrics)
                            .map(([metricName, scores]) => {
                              const average =
                                scores.reduce((sum, score) => sum + score, 0) / scores.length;
                              return {
                                name: metricName,
                                score: average,
                                count: scores.length,
                              };
                            })
                            .sort((a, b) => b.score - a.score); // Sort by highest score first

                          return (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {/* Average metrics visualization */}
                              <div className="bg-gray-800/50 p-4 rounded-lg">
                                <h5 className="text-sm font-medium text-gray-300 mb-3">
                                  Average Scores
                                </h5>
                                {averageMetrics.length > 0 ? (
                                  <div className="space-y-4">
                                    {averageMetrics.map((metric) => (
                                      <div key={metric.name} className="mb-3">
                                        <div className="flex justify-between items-center">
                                          <div className="text-sm text-gray-400">
                                            {metric.name.split('.').pop()}
                                          </div>
                                          <div
                                            className={`text-lg font-bold ${getMetricColor(metric.score)}`}
                                          >
                                            {(metric.score * 100).toFixed(1)}%
                                          </div>
                                        </div>
                                        <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                                          <div
                                            className={`h-full rounded-full ${
                                              metric.score >= 0.8
                                                ? 'bg-green-500'
                                                : metric.score >= 0.6
                                                  ? 'bg-yellow-500'
                                                  : 'bg-red-500'
                                            }`}
                                            style={{ width: `${metric.score * 100}%` }}
                                          ></div>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                          Based on {metric.count} prompts
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-gray-400">No metrics available</p>
                                )}
                              </div>

                              {/* Distribution chart */}
                              <div className="bg-gray-800/50 p-4 rounded-lg">
                                <h5 className="text-sm font-medium text-gray-300 mb-3">
                                  Score Distribution
                                </h5>
                                <div className="flex items-end h-40 mt-4 space-x-2">
                                  {averageMetrics.slice(0, 5).map((metric) => {
                                    const heightPercentage = metric.score * 100;
                                    const colorClass =
                                      metric.score >= 0.8
                                        ? 'bg-green-500'
                                        : metric.score >= 0.6
                                          ? 'bg-yellow-500'
                                          : 'bg-red-500';

                                    return (
                                      <div
                                        key={metric.name}
                                        className="flex-1 flex flex-col items-center"
                                      >
                                        <div className="text-xs text-gray-400 mb-1">
                                          {(metric.score * 100).toFixed(0)}%
                                        </div>
                                        <div
                                          className={`w-full rounded-t-md ${colorClass}`}
                                          style={{ height: `${heightPercentage}%` }}
                                        ></div>
                                        <div
                                          className="text-xs text-gray-400 mt-2 truncate w-full text-center"
                                          title={metric.name}
                                        >
                                          {metric.name.split('.').pop()}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Detailed per-prompt metrics */}
                      <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700">
                        <h4 className="text-sm font-medium text-gray-300 mb-3">
                          Detailed Prompt Metrics
                        </h4>

                        <div className="space-y-4">
                          {jobDetails.evaluationResults.map((result, index) => (
                            <div key={index} className="bg-gray-800/50 p-4 rounded-lg">
                              <div className="mb-3">
                                <h5 className="text-sm font-medium text-gray-300 mb-1">
                                  Prompt {index + 1}
                                </h5>
                                <p className="text-xs text-gray-400 line-clamp-2">
                                  {result.prompt || result.input || 'No prompt available'}
                                </p>
                              </div>

                              {/* Metrics visualization */}
                              {result.metrics && Object.keys(result.metrics).length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {Object.entries(result.metrics).map(
                                    ([metricName, metricValue]: [string, any]) => {
                                      const score =
                                        typeof metricValue === 'number'
                                          ? metricValue
                                          : metricValue.score !== undefined
                                            ? metricValue.score
                                            : 0;

                                      return (
                                        <div
                                          key={metricName}
                                          className="bg-gray-900/50 p-3 rounded-lg"
                                        >
                                          <div className="flex justify-between items-center">
                                            <div className="text-sm text-gray-400">
                                              {metricName.split('.').pop()}
                                            </div>
                                            <div
                                              className={`text-lg font-bold ${getMetricColor(score)}`}
                                            >
                                              {(score * 100).toFixed(1)}%
                                            </div>
                                          </div>
                                          <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                              className={`h-full rounded-full ${
                                                score >= 0.8
                                                  ? 'bg-green-500'
                                                  : score >= 0.6
                                                    ? 'bg-yellow-500'
                                                    : 'bg-red-500'
                                              }`}
                                              style={{ width: `${score * 100}%` }}
                                            ></div>
                                          </div>

                                          {/* Explanation if available */}
                                          {metricValue.explanation && (
                                            <div className="mt-2 text-xs text-gray-400 bg-gray-800/50 p-2 rounded border border-gray-700">
                                              <p className="font-medium text-gray-300 mb-1">
                                                Explanation:
                                              </p>
                                              <p>{metricValue.explanation}</p>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              )}

                              {/* Ground truth and response comparison if available */}
                              {(result.groundTruth || result.response) && (
                                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {result.groundTruth && (
                                    <div className="bg-gray-900/50 p-3 rounded-lg">
                                      <h6 className="text-xs font-medium text-blue-400 mb-1">
                                        Ground Truth
                                      </h6>
                                      <p className="text-xs text-gray-300 max-h-24 overflow-y-auto">
                                        {result.groundTruth}
                                      </p>
                                    </div>
                                  )}
                                  {result.response && (
                                    <div className="bg-gray-900/50 p-3 rounded-lg">
                                      <h6 className="text-xs font-medium text-purple-400 mb-1">
                                        Response
                                      </h6>
                                      <p className="text-xs text-gray-300 max-h-24 overflow-y-auto">
                                        {result.response}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* No metrics available message */}
                  {(!jobDetails.metrics || jobDetails.metrics.length === 0) &&
                    (!jobDetails.evaluationResults ||
                      jobDetails.evaluationResults.length === 0) && (
                      <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700 text-center">
                        <p className="text-gray-400">No metrics available</p>
                      </div>
                    )}
                </div>
              )}

              {/* View Full Results Button */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => onSelectJob(jobDetails.jobId, jobDetails.outputLocation)}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl text-white font-medium hover:from-purple-600 hover:to-blue-600 transition-all flex items-center"
                >
                  View Full Results
                  <ChevronRight className="h-4 w-4 ml-2" />
                </button>
                {jobDetails.status === 'COMPLETED' && jobDetails.outputLocation && (
                  <button
                    onClick={() => downloadOutputFile(jobDetails.jobId)}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-teal-500 rounded-xl text-white font-medium hover:from-blue-600 hover:to-teal-600 transition-all flex items-center"
                  >
                    Download Results
                    <Download className="h-4 w-4 ml-2" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-400">No job details available</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PreviousEvaluations;
