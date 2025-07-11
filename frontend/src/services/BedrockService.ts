// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import {
  BedrockClient,
  CreateEvaluationJobCommand,
  CreateEvaluationJobCommandInput,
  GetEvaluationJobCommand,
  GetEvaluationJobCommandInput,
  ListEvaluationJobsCommand,
  ListEvaluationJobsCommandInput,
  EvaluationConfig,
  ModelCustomizationJobStatus,
  ListEvaluationJobsCommandOutput,
} from '@aws-sdk/client-bedrock';

import AutomatedMember = EvaluationConfig.AutomatedMember;

export interface FoundationModel {
  modelId: string;
  modelName: string;
  providerName: string;
  inputModalities: string[];
  outputModalities: string[];
  inferenceTypesSupported: string[];
  customizationSupported: boolean;
}

export interface CustomModel {
  modelId: string;
  modelName: string;
  baseModelId: string;
  createdAt: Date;
  status: string;
}

export interface ModelCustomizationJob {
  jobId: string;
  jobName: string;
  modelId: string;
  status: ModelCustomizationJobStatus;
  createdAt: Date;
  completedAt?: Date;
}

export interface EvaluationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  latency: number;
}

export interface EvaluationJobSummary {
  jobId: string;
  jobName: string;
  status: string;
  createdAt: Date;
  lastModifiedAt?: Date;
  outputLocation?: string;
}

export class BedrockService {
  private static bedrockClient: BedrockClient;
  private static initialized = false;

  static initialize(forceReload = false) {
    try {
      const awsCredentials = localStorage.getItem('aws-credentials');
      if (awsCredentials) {
        const parsedCredentials = JSON.parse(awsCredentials);

        // Initialize AWS client with aws-credentials
        const credentials = {
          accessKeyId: parsedCredentials.accessKeyId,
          secretAccessKey: parsedCredentials.secretAccessKey,
          sessionToken: parsedCredentials.sessionToken || undefined,
        };

        const region = parsedCredentials.region || 'us-east-1';
        this.bedrockClient = new BedrockClient({
          credentials,
          region,
        });

        this.initialized = true;
        return;
      }
    } catch (error) {
      console.warn('Failed to load aws-credentials from local storage:', error);
    }
  }

  static async startEvaluation(
    s3BucketName: string,
    inputFileKey: string,
    outputFolder: string,
    jobName: string,
  ) {
    const evalInputUri = `s3://${s3BucketName}/${inputFileKey}`;
    const evalOutputUri = `s3://${s3BucketName}/${outputFolder}`;
    try {
      this.initialize();
      const params: CreateEvaluationJobCommandInput = {
        jobName: jobName,
        roleArn: 'arn:aws:iam::907978043781:role/qbusiness-query-eval',
        applicationType: 'RagEvaluation',
        evaluationConfig: this.buildEvalConfig(
          jobName,
          evalInputUri,
          'anthropic.claude-3-5-sonnet-20240620-v1:0',
        ),
        inferenceConfig: this.buildInferenceConfig(),
        outputDataConfig: {
          s3Uri: evalOutputUri,
        },
      };
      const command = new CreateEvaluationJobCommand(params);
      return this.bedrockClient.send(command);
      // return 'bla'
    } catch (error) {
      console.error('Error creating evaluation job in bedrock:', error);
      throw error;
    }
  }

  static buildEvalConfig(
    datasetName: string,
    inputS3Uri: string,
    modelIdentifier: string,
  ): AutomatedMember {
    return {
      automated: {
        datasetMetricConfigs: [
          {
            taskType: 'Summarization',
            dataset: {
              name: datasetName,
              datasetLocation: {
                s3Uri: inputS3Uri,
              },
            },
            metricNames: [
              'Builtin.Helpfulness',
              'Builtin.Correctness',
              'Builtin.LogicalCoherence',
              'Builtin.Faithfulness',
              'Builtin.Completeness',
              'Builtin.CitationPrecision',
              'Builtin.CitationCoverage',
              'Builtin.Harmfulness',
            ],
          },
        ],
        evaluatorModelConfig: {
          bedrockEvaluatorModels: [
            {
              modelIdentifier: modelIdentifier,
            },
          ],
        },
      },
    };
  }

  static buildInferenceConfig() {
    return {
      ragConfigs: [
        {
          precomputedRagSourceConfig: {
            retrieveAndGenerateSourceConfig: {
              ragSourceIdentifier: 'user_knowledge_base',
            },
          },
        },
      ],
    };
  }

  /**
   * Get the status and details of an evaluation job
   * @param jobId The ID of the evaluation job to check
   * @returns The response from the GetEvaluationJobCommand
   */
  static async getEvaluationJobStatus(jobId: string) {
    try {
      this.initialize();
      const params: GetEvaluationJobCommandInput = {
        jobIdentifier: jobId,
      };
      const command = new GetEvaluationJobCommand(params);
      return this.bedrockClient.send(command);
    } catch (error) {
      console.error('Error getting evaluation job status:', error);
      throw error;
    }
  }

  /**
   * List all evaluation jobs
   * @param maxResults Maximum number of results to return (default: 10)
   * @param nextToken Token for pagination
   * @returns The response from the ListEvaluationJobsCommand
   */
  static async listEvaluationJobs(
    maxResults = 10,
    nextToken?: string,
  ): Promise<ListEvaluationJobsCommandOutput> {
    try {
      this.initialize();
      const params: ListEvaluationJobsCommandInput = {
        maxResults,
        nextToken,
      };
      const command = new ListEvaluationJobsCommand(params);
      return this.bedrockClient.send(command);
    } catch (error) {
      console.error('Error listing evaluation jobs:', error);
      throw error;
    }
  }
}

// Initialize the service when the module is loaded
if (typeof window !== 'undefined') {
  BedrockService.initialize();
}
