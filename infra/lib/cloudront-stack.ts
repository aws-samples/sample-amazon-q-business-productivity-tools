// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Duration, Stack, StackProps, Fn } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';


export interface CloudfrontStackProps extends StackProps {
  backendStackName?: string;
}

export class CloudfronStack extends Stack {
  constructor(scope: Construct, id: string, props?: CloudfrontStackProps) {
    super(scope, id, props);

     const projectId = new cdk.CfnParameter(this, "ProjectId", {
          type: "String",
          description: "Project identifier used for naming resources",
          default: "qbusiness-tools-backend",
        });
    
    
        const originVerifySecretArn = Fn.importValue("AlbOriginVerifySecretArn");

      const originSecret = new secretsmanager.Secret(this, 'OriginVerifySecret', {
      description: 'Secret for CloudFront to ALB authentication',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({}),
        generateStringKey: 'headerValue',
        excludeCharacters: ' %+~`#$&*()|[]{}:;<>?!\'/@"\\',
        passwordLength: 32
      }
    });
   
    // Parameter to control the protocol policy for the ALB origin
    const albOriginProtocol = new cdk.CfnParameter(this, "CfnFrontendStackAlbOriginProtocol", {
      type: "String",
      description: "Protocol to use for communication between CloudFront and ALB",
      default: "HTTP_ONLY",
      allowedValues: ["HTTP_ONLY", "HTTPS_ONLY", "ALLOW_ALL"],
    });
    
    // Parameter to control the viewer protocol policy
    const viewerProtocolPolicy = new cdk.CfnParameter(this, "CfnFrontendStackViewerProtocolPolicy", {
      type: "String",
      description: "Protocol policy for viewers connecting to CloudFront",
      default: "ALLOW_ALL",
      allowedValues: ["REDIRECT_TO_HTTPS", "HTTPS_ONLY", "ALLOW_ALL"],
    });
    
    // Import the ALB DNS name from the backend stack if provided
    const loadBalancerDnsName = Fn.importValue( `${projectId.valueAsString}-LoadBalancerDnsName`,);

    // S3 bucket creation
    const staticSiteBucket = new Bucket(this, 'S3StaticBucket', {
      versioned: true,
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL
    });

    //Content deployment 
    new s3deploy.BucketDeployment(this, 'FrontendStackDeployWebsite', {
      sources: [s3deploy.Source.asset('../frontend/build')], // Path to your React build output
      destinationBucket: staticSiteBucket,
    });

    //OAI creation for CDN access
    const oai = new cloudfront.OriginAccessIdentity(this, 'LoclStackStaticOAI', {
      comment: "Created by CDK for static site"
    });

    staticSiteBucket.grantRead(oai)

    // Lambda@edge handlers creation
    const lambdaRole = new iam.Role(this, 'FrontendStackEdgeFunctionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue'],
        resources: [`arn:aws:secretsmanager:*:*:secret:qbusiness-tools-cognito-secret*`],
      })
    );
    lambdaRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));

    // Creation of cloudfront
    const errorResponse: cloudfront.ErrorResponse = {
      httpStatus: 404,
      responseHttpStatus: 200,
      responsePagePath: '/error.html',
      ttl: cdk.Duration.minutes(30),
    };
    
    // Create origin request policy for the S3 origin
    const s3OriginRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'S3OriginRequestPolicy', {
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.allowList("token")
    });
    
    // Create origin request policy for the ALB origin
    const albOriginRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'ALBOriginRequestPolicy', {
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(), // Pass all query string parameters to the origin
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList('Host'), // Only include Host header in origin request
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.all()
    });
    
    // Create cache policy for the ALB origin
    const albCachePolicy = new cloudfront.CachePolicy(this, 'ALBCachePolicy', {
      defaultTtl: Duration.seconds(0),
      minTtl: Duration.seconds(0),
      maxTtl: Duration.seconds(0),
    });
    
    // Create the S3 origin
    const s3Origin = new origins.S3Origin(staticSiteBucket, {
      originAccessIdentity: oai
    });
    
    // Create the ALB origin with protocol policy based on parameter
    const protocolPolicyMap: { [key: string]: cloudfront.OriginProtocolPolicy } = {
      'HTTP_ONLY': cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      'HTTPS_ONLY': cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      'MATCH_VIEWER': cloudfront.OriginProtocolPolicy.MATCH_VIEWER,
    };

     const originVerifySecret = secretsmanager.Secret.fromSecretCompleteArn(
          this,
          "ImportedOriginVerifySecret",
          originVerifySecretArn
        );
    
    // Using unsafeUnwrap() to explicitly acknowledge the risk of exposing the secret
    const secretHeaderValue = originVerifySecret.secretValueFromJson('headerValue').unsafeUnwrap();
    const albOrigin = new origins.HttpOrigin(loadBalancerDnsName, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      customHeaders: {
        'x-origin-verify': secretHeaderValue,
      },
    });
    
    // Map the viewer protocol policy parameter to CloudFront enum values
    const viewerProtocolPolicyMap: { [key: string]: cloudfront.ViewerProtocolPolicy } = {
      'REDIRECT_TO_HTTPS': cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      'HTTPS_ONLY': cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      'ALLOW_ALL': cloudfront.ViewerProtocolPolicy.ALLOW_ALL,
    };
    
    const selectedViewerProtocolPolicy = viewerProtocolPolicyMap[viewerProtocolPolicy.valueAsString];
    
    const distribution = new cloudfront.Distribution(this, 'FrontendStackCloudFrontCongitoStackDistribution', {
      defaultBehavior: {
        origin: s3Origin,
        originRequestPolicy: s3OriginRequestPolicy,
        viewerProtocolPolicy: selectedViewerProtocolPolicy,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: albOrigin,
          originRequestPolicy: albOriginRequestPolicy,
          cachePolicy: albCachePolicy,
          viewerProtocolPolicy: selectedViewerProtocolPolicy,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        }
      },
      enableLogging: true,
      logIncludesCookies: true,
      logFilePrefix: 'cloudfront-logs',
      defaultRootObject: 'index.html',
      errorResponses: [errorResponse]
    })


    new cdk.CfnOutput(this, "FrontendStackCfnDistribution", {
      value: distribution.distributionDomainName,
      description: "The CloudFront distribution domain name",
      exportName: `Distribution`,
    });

    new cdk.CfnOutput(this, 'FrontendStackCfnBucketName', {
      value: staticSiteBucket.bucketName,
      description: 'The name of the S3 bucket',
      exportName: `S3Bucket`,
    });
    
    // Output the configured protocol policies
    new cdk.CfnOutput(this, 'FrontendStackOutputCfnAlbOriginProtocolPolicy', {
      value: albOriginProtocol.valueAsString,
      description: 'Protocol policy used for communication between CloudFront and ALB',
    });
    
    new cdk.CfnOutput(this, 'FrontendStackOutputCfnViewerProtocolPolicy', {
      value: viewerProtocolPolicy.valueAsString,
      description: 'Protocol policy used for viewers connecting to CloudFront',
    });
  }

}
