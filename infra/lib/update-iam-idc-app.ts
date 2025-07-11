// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as customresources from 'aws-cdk-lib/custom-resources';
import {Fn} from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import {Role} from "aws-cdk-lib/aws-iam";

export interface IamIdentityCenterStackProps extends cdk.StackProps {
}

export class UpdateIamIdcApp extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: IamIdentityCenterStackProps) {
        super(scope, id, props);

        const cognitoUserPoolId = Fn.importValue('CognitoUserPoolId');
        const cognitoUserPoolClientId = Fn.importValue('CognitoUserPoolClientId');
        const qBusinessChatRole = Fn.importValue('QBusinessChatRole');
        const iamIdcInstanceArn = Fn.importValue('QBusinessToolsIamIdcInstanceArn');
        const applicationArn = Fn.importValue('QBusinessToolsIamIdcAppArn');

        const roleToCreateTti = this.roleForCreatingTrustedTokenIssuer()
        const createTtiCustomResource = this.createTrustedTokenIssuer(cognitoUserPoolId, iamIdcInstanceArn, roleToCreateTti);
        const ttiArn = createTtiCustomResource.getResponseField('TrustedTokenIssuerArn');

        const roleToPutApplicationAuthenticationMethod = this.roleToPutApplicationAuthenticationMethod();
        const assignTtiCustomResource = this.assignTrustedTokenIssuer(applicationArn, ttiArn, cognitoUserPoolClientId, roleToPutApplicationAuthenticationMethod);
        assignTtiCustomResource.node.addDependency(createTtiCustomResource)

        const putApplicationAuthenticationMethodCustomResource = this.putApplicationAuthenticationMethod(applicationArn, ttiArn, qBusinessChatRole, roleToPutApplicationAuthenticationMethod);
        putApplicationAuthenticationMethodCustomResource.node.addDependency(createTtiCustomResource)
    }

    roleForCreatingTrustedTokenIssuer(): Role {
        return new iam.Role(this, 'TtiCustomRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
            inlinePolicies: {
                SSOAdminPolicy: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'sso:CreateApplication',
                                'sso:DeleteApplication',
                                'sso:DescribeApplication',
                                'sso:PutApplicationGrant',
                                'sso:DeleteApplicationGrant',
                                'sso:PutApplicationAuthenticationMethod',
                                'sso:DeleteApplicationAuthenticationMethod',
                                'sso:CreateTrustedTokenIssuer',
                                'sso:DeleteTrustedTokenIssuer',
                                'sso:DescribeTrustedTokenIssuer',
                                'sso:UpdateTrustedTokenIssuer',
                                'sso-admin:*',
                            ],
                            resources: ['*'],
                        }),
                    ],
                }),
            },
        });

    }

    createTrustedTokenIssuer(cognitoUserPoolId: string, iamIdentityCenterArn: string, role: Role) {
        const issuerUrl = `https://cognito-idp.${process.env.CDK_DEFAULT_REGION}.amazonaws.com/${cognitoUserPoolId}`;
        return new customresources.AwsCustomResource(this, 'CreateTrustedTokenIssuer', {
            onCreate: {
                service: 'SSOAdmin',
                action: 'createTrustedTokenIssuer',
                parameters: {
                    Name: 'QBusinessToolsCognitoTrustedTokenIssuer',
                    ClientToken: cdk.Names.uniqueId(this) + '-issuer',
                    InstanceArn: iamIdentityCenterArn,
                    TrustedTokenIssuerType: 'OIDC_JWT',
                    TrustedTokenIssuerConfiguration: {
                        OidcJwtConfiguration: {
                            IssuerUrl: issuerUrl,
                            ClaimAttributePath: 'email',
                            IdentityStoreAttributePath: "emails.value",
                            JwksRetrievalOption: 'OPEN_ID_DISCOVERY'
                        }
                    }
                },
                physicalResourceId: customresources.PhysicalResourceId.of('QBusinessTrustedTokenIssuer-' + cdk.Names.uniqueId(this))
            },
            onDelete: {
                service: 'SSOAdmin',
                action: 'deleteTrustedTokenIssuer',
                parameters: {
                    TrustedTokenIssuerArn: new customresources.PhysicalResourceIdReference(),
                },
            },
            policy: customresources.AwsCustomResourcePolicy.fromSdkCalls({
                resources: customresources.AwsCustomResourcePolicy.ANY_RESOURCE,
            }),
            role: role,
            logRetention: logs.RetentionDays.ONE_DAY,
        });
    }

    assignTrustedTokenIssuer(iamIdentityCenterArn: string, ttiArn: string, cognitoUserPoolClientId: string, role: Role) {
        return new customresources.AwsCustomResource(this, 'AssignTrustedTokenIssuer', {
            onCreate: {
                service: 'SSOAdmin',
                action: 'putApplicationGrant',
                parameters: {
                    ApplicationArn: iamIdentityCenterArn,
                    GrantType: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    Grant: {
                        JwtBearer: {
                            AuthorizedTokenIssuers: [
                                {
                                    TrustedTokenIssuerArn: ttiArn,
                                    AuthorizedAudiences: [
                                        cognitoUserPoolClientId
                                    ]
                                }
                            ]
                        }
                    }
                },
                physicalResourceId: customresources.PhysicalResourceId.of('AssignTrustedTokenIssuer-' + cdk.Names.uniqueId(this))
            },
            policy: customresources.AwsCustomResourcePolicy.fromSdkCalls({
                resources: customresources.AwsCustomResourcePolicy.ANY_RESOURCE,
            }),
            role: role,
        });

    }

    roleToPutApplicationAuthenticationMethod() {
        return new iam.Role(this, 'PutApplicationAuthenticationMethodRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
            inlinePolicies: {
                SSOAdminPolicy: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'sso:CreateApplication',
                                'sso:DeleteApplication',
                                'sso:DescribeApplication',
                                'sso:PutApplicationGrant',
                                'sso:DeleteApplicationGrant',
                                'sso:PutApplicationAuthenticationMethod',
                                'sso:DeleteApplicationAuthenticationMethod',
                                'sso:CreateTrustedTokenIssuer',
                                'sso:DeleteTrustedTokenIssuer',
                                'sso:DescribeTrustedTokenIssuer',
                                'sso:UpdateTrustedTokenIssuer',
                                'sso-admin:*',
                            ],
                            resources: ['*'],
                        }),
                    ],
                }),
            },
        });

    }

    putApplicationAuthenticationMethod(iamIdentityCenterApplicationArn: string, ttiArn: string, roleToAssume: string, putApplicationAuthenticationMethodRole: Role) {
        return new customresources.AwsCustomResource(this, 'ApplicationAuthenticationMethod', {
            onCreate: {
                service: 'SSOAdmin',
                action: 'putApplicationAuthenticationMethod',
                parameters: {
                    ApplicationArn: iamIdentityCenterApplicationArn,
                    TrustedTokenIssuerArn: ttiArn,
                    AuthenticationMethodType: 'IAM',
                    AuthenticationMethod: {
                        Iam: {
                            ActorPolicy: {
                                Version: "2012-10-17",
                                Statement: [
                                    {
                                        Effect: "Allow",
                                        Principal: {
                                            AWS: roleToAssume
                                        },
                                        Action: "sso-oauth:CreateTokenWithIAM",
                                        Resource: "*"
                                    }
                                ]
                            }
                        }
                    }
                },
                physicalResourceId: customresources.PhysicalResourceId.of('ApplicationAuthenticationMethod-' + cdk.Names.uniqueId(this))
            },
            policy: customresources.AwsCustomResourcePolicy.fromSdkCalls({
                resources: customresources.AwsCustomResourcePolicy.ANY_RESOURCE,
            }),
            role: putApplicationAuthenticationMethodRole,
        });

    }

    putApplicationAssignmentConfiguration(iamIdentityCenterAppArn: string) {
        return new customresources.AwsCustomResource(this, 'PutApplicationAssignmentConfiguration', {
            onCreate: {
                service: 'SSOAdmin',
                action: 'putApplicationAssignmentConfiguration',
                parameters: {
                    AssignmentRequired: false,
                    NoAssignmentRequired: true,
                    ApplicationArn: iamIdentityCenterAppArn
                },
                physicalResourceId: customresources.PhysicalResourceId.of('PutApplicationAssignmentConfiguration-' + cdk.Names.uniqueId(this))
            },
            policy: customresources.AwsCustomResourcePolicy.fromSdkCalls({
                resources: customresources.AwsCustomResourcePolicy.ANY_RESOURCE
            })
        });
    }
}
