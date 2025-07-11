// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Injectable, Logger } from '@nestjs/common';
import {
  BedrockClient,
  CreateEvaluationJobCommand,
  GetEvaluationJobCommand,
  ListEvaluationJobsCommand,
  ApplicationType,
} from '@aws-sdk/client-bedrock';
import * as dotenv from 'dotenv';
import { getClientWithSessionAsync } from './aws-client.utils';
import { DynamoDBService } from './dynamodb.service';

// Load environment variables
dotenv.config();

@Injectable()
export class BedrockService {
  private readonly logger = new Logger(BedrockService.name);
  private readonly bedrockClient: BedrockClient;
  private readonly region: string;

  constructor(private readonly dynamoDBService: DynamoDBService) {
    // Get region from environment variables or use default
    this.region = 'us-east-1'; // Bedrock is only available in us-east-1 for now

    // Initialize AWS client for Bedrock
    this.bedrockClient = new BedrockClient({ region: this.region });
  }

  /**
   * Get a Bedrock client, optionally using credentials from a session
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns A client for the Bedrock service
   */
  async getClient(sessionId?: string): Promise<BedrockClient> {
    return getClientWithSessionAsync<BedrockClient>(
      'bedrock',
      this.region,
      this.bedrockClient,
      sessionId,
      undefined,
      this.dynamoDBService,
    );
  }

  /**
   * Start a Bedrock evaluation job
   * @param s3BucketName The S3 bucket name
   * @param inputFileKey The key of the input file in the S3 bucket
   * @param outputFolder The folder in the S3 bucket to store output
   * @param jobName The name of the evaluation job
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns The response from the CreateEvaluationJob API
   */
  async startEvaluation(
    s3BucketName: string,
    inputFileKey: string,
    outputFolder: string,
    jobName: string,
    sessionId?: string,
  ): Promise<any> {
    try {
      const evalInputUri = `s3://${s3BucketName}/${inputFileKey}`;
      const evalOutputUri = `s3://${s3BucketName}/${outputFolder}`;

      const client = await this.getClient(sessionId);

      const params = {
        jobName,
        roleArn: process.env.BEDROCK_QUERY_EVAL_ROLE_ARN,
        applicationType: ApplicationType.RAG_EVALUATION,
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
      const response = await client.send(command);
      return response;
    } catch (error) {
      this.logger.error(`Error creating evaluation job in bedrock: ${error}`);
      throw error;
    }
  }

  /**
   * Build the evaluation configuration for a Bedrock evaluation job
   * @param datasetName The name of the dataset
   * @param inputS3Uri The S3 URI of the input dataset
   * @param modelIdentifier The identifier of the model to use for evaluation
   * @returns The evaluation configuration
   */
  private buildEvalConfig(
    datasetName: string,
    inputS3Uri: string,
    modelIdentifier: string,
  ): any {
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
              modelIdentifier,
            },
          ],
        },
      },
    };
  }

  /**
   * Build the inference configuration for a Bedrock evaluation job
   * @returns The inference configuration
   */
  private buildInferenceConfig(): any {
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
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns The response from the GetEvaluationJob API
   */
  async getEvaluationJobStatus(
    jobId: string,
    sessionId?: string,
  ): Promise<any> {
    try {
      const client = await this.getClient(sessionId);
      console.log(`Getting evaluation job status for job_id ${jobId}`);

      const params = {
        jobIdentifier: jobId,
      };

      const command = new GetEvaluationJobCommand(params);
      const response = await client.send(command);
      return response;
    } catch (error) {
      this.logger.error(`Error getting evaluation job status: ${error}`);
      throw error;
    }
  }

  /**
   * List all evaluation jobs
   * @param maxResults Maximum number of results to return (default: 10)
   * @param nextToken Token for pagination
   * @param sessionId Optional session ID to fetch credentials from DynamoDB
   * @returns The response from the ListEvaluationJobs API
   */
  async listEvaluationJobs(
    maxResults: number = 10,
    nextToken?: string,
    sessionId?: string,
  ): Promise<any> {
    try {
      const client = await this.getClient(sessionId);

      const params: any = {
        maxResults,
      };

      if (nextToken) {
        params.nextToken = nextToken;
      }

      const command = new ListEvaluationJobsCommand(params);
      const response = await client.send(command);
      return response;
    } catch (error) {
      this.logger.error(`Error listing evaluation jobs: ${error}`);
      throw error;
    }
  }
}
