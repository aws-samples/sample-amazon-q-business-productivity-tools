#!/usr/bin/env node

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0


import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BackendStack } from '../lib/backend-stack';
import { CloudfronStack } from '../lib/cloudront-stack';
import { CognitoStack } from '../lib/cognito-stack';
import { UpdateIamIdcApp } from '../lib/update-iam-idc-app';
import {CreateIamIdcApp} from "../lib/create-iam-idc-app";

const app = new cdk.App();

// Create the Backend stack first
const iamIdcApp = new CreateIamIdcApp(app, 'QBusinessToolsCreateIamIdcApp', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region:  process.env.CDK_DEFAULT_REGION },
});

// Create the Backend stack first
const backendStack = new BackendStack(app, 'QBusinessToolsBackend', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region:  process.env.CDK_DEFAULT_REGION },
});

// Create the Cognito stack
const cognitoStack = new CognitoStack(app, 'QBusinessToolsCognitoStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

// Then create the CloudFront Cognito stack with a reference to the Backend stack
const frontendStack = new CloudfronStack(app, 'QBusinessToolsFrontend', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }, // Lambda@Edge must be in us-east-1
  backendStackName: backendStack.stackName,
});cdk 

// Create the IAM Identity Center stack
// This needs to be created after the CloudFront stack since it depends on the distribution URL
const identityCenterStack = new UpdateIamIdcApp(app, 'QBusinessToolsUpdateIamIdcApp', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

// Add dependencies to ensure CloudFront and Cognito stacks are deployed before IAM Identity Center stack
backendStack.addDependency(iamIdcApp);
identityCenterStack.addDependency(frontendStack);
identityCenterStack.addDependency(cognitoStack);
