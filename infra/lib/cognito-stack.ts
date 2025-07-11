// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Fn } from 'aws-cdk-lib';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

export interface CognitoStackProps extends cdk.StackProps {
}

export class CognitoStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props?: CognitoStackProps) {
    super(scope, id, props);

    // Import the CloudFront distribution domain name
    const distributionDomainName = Fn.importValue('Distribution');

    // Create a Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'QBusinessUserPool', {
      userPoolName: 'QBusinessUserPool',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development purposes, use RETAIN for production
    });

    // Create a domain for the Cognito User Pool
    const domainPrefix = `qbusiness-${this.account.substring(0, 8)}`;
    this.userPoolDomain = this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: domainPrefix,
      },
    });

    // Create a Cognito User Pool Client (without client secret)
    this.userPoolClient = this.userPool.addClient('QBusinessUserPoolClient', {
      userPoolClientName: 'QBusinessUserPoolClient',
      generateSecret: false, // No client secret as requested
      authFlows: {
        userPassword: true,
        userSrp: true,
        adminUserPassword: true,
      },
      oAuth: {
        flows: {
          implicitCodeGrant: true,
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          'http://localhost:3000',
          `https://${distributionDomainName}`,
        ],
        logoutUrls: [
          'http://localhost:3000',
          `https://${distributionDomainName}`,
        ],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
      preventUserExistenceErrors: true,
    });

    // Output the User Pool ID
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'The ID of the Cognito User Pool',
      exportName: 'CognitoUserPoolId',
    });

    // Output the User Pool Client ID
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'The ID of the Cognito User Pool Client',
      exportName: 'CognitoUserPoolClientId',
    });

    // Output the User Pool Domain URL
    new cdk.CfnOutput(this, 'UserPoolDomainUrl', {
      value: this.userPoolDomain.baseUrl(),
      description: 'The URL of the Cognito User Pool Domain',
      exportName: 'CognitoUserPoolDomainUrl',
    });

    // Output the domain prefix
    new cdk.CfnOutput(this, 'UserPoolDomainPrefix', {
      value: domainPrefix,
      description: 'The domain prefix of the Cognito User Pool',
      exportName: 'CognitoUserPoolDomainPrefix',
    });

    // Create a Secret Manager entry with Cognito configuration values
    const cognitoConfigSecret = new secretsmanager.Secret(this, 'CognitoConfigSecret', {
      description: 'Cognito User Pool configuration values',
      secretName: 'QBusinessCognitoConfig',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          userPoolId: this.userPool.userPoolId,
          clientId: this.userPoolClient.userPoolClientId,
          domainPrefix: domainPrefix,
          region: this.region,
          domainUrl: this.userPoolDomain.baseUrl(),
        }),
        generateStringKey: 'dummy', // This key is not used but required by the API
      }
    });

    // Output the Secret ARN
    new cdk.CfnOutput(this, 'CognitoConfigSecretArn', {
      value: cognitoConfigSecret.secretArn,
      description: 'The ARN of the Secret containing Cognito configuration',
      exportName: 'CognitoConfigSecretArn',
    });
  }
}
