import * as cdk from "aws-cdk-lib";
import {Construct} from "constructs";
import {Role} from "aws-cdk-lib/aws-iam";
import * as customresources from "aws-cdk-lib/custom-resources";
import * as iam from "aws-cdk-lib/aws-iam";

export interface CreateIamIdcAppProps extends cdk.StackProps {
}

export class CreateIamIdcApp extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: CreateIamIdcAppProps) {
        super(scope, id, props);

        const roleToCreateIamIdentityCenterApplication = this.createIamIdentityCenterAppCreationRole()
        const fetchIamIdentityCenterCustomResource = this.fetchIamIdentityCenterArn(roleToCreateIamIdentityCenterApplication);
        const iamIdentityCenterArn = fetchIamIdentityCenterCustomResource.getResponseField('Instances.0.InstanceArn');

        const createApplicationCustomResource = this.createApp(iamIdentityCenterArn, roleToCreateIamIdentityCenterApplication)
        const applicationArn = createApplicationCustomResource.getResponseField('ApplicationArn');
        createApplicationCustomResource.node.addDependency(fetchIamIdentityCenterCustomResource)

        const putApplicationAssignmentCustomResource = this.putApplicationAssignmentConfiguration(applicationArn)

        new cdk.CfnOutput(this, "QBusinessToolsIamIdcInstanceArn", {
            value: iamIdentityCenterArn,
            description: "The IAM Identity Center Instance Arn",
            exportName: 'QBusinessToolsIamIdcInstanceArn',
        });

        new cdk.CfnOutput(this, "QBusinessToolsIamIdcApp", {
            value: applicationArn,
            description: "The IAM Identity Center Application created to chatting with QBusiness",
            exportName: 'QBusinessToolsIamIdcAppArn',
        });
    }

    createApp(iamIdentityCenterArn: string, iamIdentityCenterCreateAppRole: Role): customresources.AwsCustomResource {
        return new customresources.AwsCustomResource(this, 'QBusinessToolsIAMIDCApplication', {
            onCreate: {
                service: 'SSOAdmin',
                action: 'createApplication',
                parameters: {
                    Name: 'QBusinessToolsIDCApplication',
                    Description: 'Custom IAM IDC Application for QBusiness Tools',
                    ClientToken: cdk.Names.uniqueId(this),
                    InstanceArn: iamIdentityCenterArn,
                    ApplicationProviderArn: 'arn:aws:sso::aws:applicationProvider/custom',
                    PortalOptions: {
                        Visibility: 'DISABLED'
                    },
                    AuthenticationMethod: 'OAUTH_2_0',
                    SkipAssignment: true
                },
                physicalResourceId: customresources.PhysicalResourceId.of('QBusinessToolsIAMIDCApplication-' + cdk.Names.uniqueId(this))
            },
            policy: customresources.AwsCustomResourcePolicy.fromSdkCalls({
                resources: customresources.AwsCustomResourcePolicy.ANY_RESOURCE
            }),
            role: iamIdentityCenterCreateAppRole,
        });
    }

    fetchIamIdentityCenterArn(iamIdentityCenterCreateAppRole: Role){
        return new customresources.AwsCustomResource(this, 'GetIdentityCenterInstance', {
            onCreate: {
                service: 'SSOAdmin',
                action: 'listInstances',
                parameters: {},
                physicalResourceId: customresources.PhysicalResourceId.of('IdentityCenterInstance-' + cdk.Names.uniqueId(this))
            },
            policy: customresources.AwsCustomResourcePolicy.fromSdkCalls({
                resources: customresources.AwsCustomResourcePolicy.ANY_RESOURCE
            }),
            role: iamIdentityCenterCreateAppRole,
        });
    }

    createIamIdentityCenterAppCreationRole() {
        return new iam.Role(this, 'IamIdentityCenterApplication', {
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
                                'sso:ListInstances',
                                'sso:PutApplicationAssignmentConfiguration',
                            ],
                            resources: ['*'],
                        }),
                    ],
                }),
            },
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