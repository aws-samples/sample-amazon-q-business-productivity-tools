// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as cdk from "aws-cdk-lib";
import {Construct} from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ecrAssets from "aws-cdk-lib/aws-ecr-assets";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as path from "path";
import {Duration, Fn, StackProps} from "aws-cdk-lib";
import {Role} from "aws-cdk-lib/aws-iam";
import {Table} from "aws-cdk-lib/aws-dynamodb";

export interface BackendStackProps extends StackProps {
}

export class BackendStack extends cdk.Stack {

    constructor(scope: Construct, id: string, props: BackendStackProps) {
        super(scope, id, props);

        const projectId = new cdk.CfnParameter(this, "ProjectId", {
            type: "String",
            description: "Project identifier used for naming resources",
            default: "qbusiness-tools-backend",
        });

        const originSecret = new secretsmanager.Secret(this, 'OriginVerifySecret', {
            description: 'Secret for CloudFront to ALB authentication',
            generateSecretString: {
                secretStringTemplate: JSON.stringify({}),
                generateStringKey: 'headerValue',
                excludeCharacters: ' %+~`#$&*()|[]{}:;<>?!\'/@"\\',
                passwordLength: 32
            }
        });

        new cdk.CfnOutput(this, "OriginVerifySecretArn", {
            value: originSecret.secretArn,
            description: "The ARN of the secret used for CloudFront to ALB authentication",
            exportName: "AlbOriginVerifySecretArn",
        });

        const maxResponseSize = new cdk.CfnParameter(this, "MaxResponseSize", {
            type: "Number",
            description: "Maximum size for row query results in bytes",
            default: 25600,
        });

        const taskCpu = new cdk.CfnParameter(this, "TaskCpu", {
            type: "Number",
            description:
                "CPU units for Fargate task (256=0.25vCPU, 512=0.5vCPU, 1024=1vCPU, 2048=2vCPU, 4096=4vCPU)",
            default: 2048,
        });

        const taskMemory = new cdk.CfnParameter(this, "TaskMemory", {
            type: "Number",
            description: "Memory (in MiB) for Fargate task",
            default: 4096,
        });

        const serviceDesiredCount = new cdk.CfnParameter(
            this,
            "ServiceDesiredCount",
            {
                type: "Number",
                description: "Desired count of tasks for the Fargate service",
                default: 1,
                minValue: 1,
                maxValue: 10,
            }
        );


        const vpc = new ec2.Vpc(this, "QBusinessBackendStackVpc", {
            vpcName: `${projectId.valueAsString}-vpc`,
            ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/21"),
            maxAzs: 3,
            natGateways: 1,
            subnetConfiguration: [
                {
                    subnetType: ec2.SubnetType.PUBLIC,
                    name: "Ingress",
                    cidrMask: 24,
                },
                {
                    cidrMask: 24,
                    name: "Private",
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                },
            ],
        });

        // Keep only gateway endpoints, removing all interface endpoints
        vpc.addGatewayEndpoint("S3Endpoint", {
            service: ec2.GatewayVpcEndpointAwsService.S3,
            subnets: [{subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS}],
        });

        vpc.addGatewayEndpoint("DynamoDBEndpoint", {
            service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
            subnets: [{subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS}],
        });

        const qbusinessQueryEvalRole = this.createBedrockQueryEvalRole(projectId.valueAsString)
        const userSessionTable = this.createUserSessionTable()

        // =================== FARGATE SERVICE SETUP ===================
        // Create ECS Cluster
        const ecsCluster = new ecs.Cluster(this, "BackendStack", {
            vpc: vpc,
            clusterName: `${projectId.valueAsString}-cluster`,
            containerInsightsV2: ecs.ContainerInsights.ENHANCED,
        });

        // Create log group for Fargate service
        const logGroup = new logs.LogGroup(this, "BackendStackLogGroup", {
            logGroupName: `/ecs/${projectId.valueAsString}-agent-service`,
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        // Create execution role for Fargate task
        const executionRole = new iam.Role(this, "BackendStackTaskExecutionRole", {
            assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
            roleName: `${projectId.valueAsString}-task-execution-role`,
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName(
                    "service-role/AmazonECSTaskExecutionRolePolicy"
                ),
            ],
        });

        // Create task role for Fargate task
        const fargateTaskRole = this.createFargateTaskRole(projectId.valueAsString, qbusinessQueryEvalRole, userSessionTable)
        // Create a task definition with parameterized CPU and memory
        const taskDefinition = new ecs.FargateTaskDefinition(
            this,
            "QBusinessBackendTaskDefinition",
            {
                memoryLimitMiB: taskMemory.valueAsNumber,
                cpu: taskCpu.valueAsNumber,
                executionRole,
                taskRole: fargateTaskRole,
                runtimePlatform: {
                    cpuArchitecture: ecs.CpuArchitecture.ARM64,
                    operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
                },
            }
        );

        // This will use the Dockerfile in the TypeScript backend directory
        const dockerAsset = new ecrAssets.DockerImageAsset(this, "BackendStackImage", {
            directory: path.join(__dirname, "../../backend/typescript"),
            file: "./Dockerfile",
            platform: ecrAssets.Platform.LINUX_ARM64,
        });

        const qbusinessChatRole = this.createQBusinessChatRole(projectId.valueAsString, fargateTaskRole)
        // Add a policy to the assuming role that allows it to assume the assumed role
        fargateTaskRole.addToPolicy(new iam.PolicyStatement({
            actions: ['sts:*'],
            resources: [qbusinessChatRole.roleArn],
        }));

        const qbusinessAnonymousAccessRole = this.createQBusinessAnonymousAccessRole(projectId.valueAsString)

        // Define the container port
        const containerPort = 3001;
        const idcAppArn = Fn.importValue('QBusinessToolsIamIdcAppArn');

        // Add container to the task definition
        const container = taskDefinition.addContainer("BackendStackContainer", {
            image: ecs.ContainerImage.fromDockerImageAsset(dockerAsset),
            logging: ecs.LogDrivers.awsLogs({
                streamPrefix: "qbusiness-tools-backend",
                logGroup,
            }),
            environment: {
                AWS_REGION: process.env.CDK_DEFAULT_REGION!,
                MAX_RESPONSE_SIZE_BYTES: maxResponseSize.valueAsString,
                BEDROCK_QUERY_EVAL_ROLE_ARN: qbusinessQueryEvalRole.roleArn,
                QBUSINESS_ANONYMOUS_ACCESS_ROLE_ARN: qbusinessAnonymousAccessRole.roleArn,
                IDENTITY_CENTER_APPLICATION_ROLE_ARN: qbusinessChatRole.roleArn,
                IDENTITY_CENTER_APPLICATION_ID: idcAppArn
            },
            portMappings: [
                {
                    containerPort: containerPort,
                    hostPort: containerPort,
                    protocol: ecs.Protocol.TCP,
                },
            ],
        });

        // Create a security group for the Fargate service
        const agentServiceSG = new ec2.SecurityGroup(this, "BackendStackServiceSG", {
            vpc,
            description: "Security group for QBusiness Backend Fargate Service",
            allowAllOutbound: true,
        });

        // Create a Fargate service with parameterized desired count
        const service = new ecs.FargateService(this, "BackendService", {
            cluster: ecsCluster,
            taskDefinition,
            desiredCount: serviceDesiredCount.valueAsNumber,
            assignPublicIp: false,
            vpcSubnets: {subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS},
            circuitBreaker: {
                rollback: true,
            },
            securityGroups: [agentServiceSG],
            minHealthyPercent: 100,
            maxHealthyPercent: 200,
            healthCheckGracePeriod: Duration.seconds(60),
        });

        // =================== ADD APPLICATION LOAD BALANCER ===================
        const originVerifySecret = secretsmanager.Secret.fromSecretCompleteArn(
            this,
            "ImportedOriginVerifySecret",
            originSecret.secretArn
        );

        // Create a role for the ALB to access the secret
        const albRole = new iam.Role(this, "AlbSecretAccessRole", {
            assumedBy: new iam.ServicePrincipal("elasticloadbalancing.amazonaws.com"),
            roleName: `${projectId.valueAsString}-alb-secret-access-role`,
        });

        // Grant the ALB role permission to read the secret
        originVerifySecret.grantRead(albRole);

        // Create a security group for the ALB
        const albSG = new ec2.SecurityGroup(this, "AlbSecurityGroup", {
            vpc,
            description: "Security group for Agent Application Load Balancer",
            allowAllOutbound: true,
        });

        // Allow inbound HTTP traffic to the ALB on port 80
        albSG.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(80),
            "Allow HTTP traffic on port 80 from anywhere"
        );

        // Allow inbound HTTPS traffic to the ALB on port 443
        albSG.addIngressRule(
            ec2.Peer.anyIpv4(),
            ec2.Port.tcp(443),
            "Allow HTTPS traffic on port 443 from anywhere"
        );

        // Allow the ALB to communicate with the Fargate service
        agentServiceSG.addIngressRule(
            albSG,
            ec2.Port.tcp(containerPort),
            `Allow traffic from ALB to Fargate service on port ${containerPort}`
        );

        // Create an Application Load Balancer
        const lb = new elbv2.ApplicationLoadBalancer(this, "BackendStackLB", {
            vpc,
            internetFacing: true,
            securityGroup: albSG,
        });

        // Create a target group for the service
        const targetGroup = new elbv2.ApplicationTargetGroup(this, "BackendStackTargetGroup", {
            vpc,
            port: containerPort,
            protocol: elbv2.ApplicationProtocol.HTTP,
            targets: [service],
            healthCheck: {
                path: "/api/health",
                interval: Duration.seconds(30),
                timeout: Duration.seconds(5),
                healthyHttpCodes: "200",
            },
            deregistrationDelay: Duration.seconds(30),
        });

        // If no certificate ARN was provided, create an HTTP listener only
        // Create the listener with a default action that returns 403 Forbidden
        const httpListener = lb.addListener("BackendStackHttpListener", {
            port: 80,
            defaultAction: elbv2.ListenerAction.fixedResponse(403, {
                contentType: "text/plain",
                messageBody: "Access denied: Invalid or missing origin verification header",
            }),
        });

        // Add a rule that forwards requests with the correct x-origin-verify header to the target group
        // Using unsafeUnwrap() to explicitly acknowledge the risk of exposing the secret
        const secretHeaderValue = originVerifySecret.secretValueFromJson("headerValue").unsafeUnwrap();
        httpListener.addAction("VerifiedAction", {
            action: elbv2.ListenerAction.forward([targetGroup]),
            conditions: [
                elbv2.ListenerCondition.httpHeader("x-origin-verify", [secretHeaderValue])
            ],
            priority: 10,
        });

        new cdk.CfnOutput(this, "BackendStackEndpointURL", {
            value: lb.loadBalancerDnsName,
            description: "The DNS name of the Application Load Balancer for the Strands Agent",
            exportName: `${projectId.valueAsString}-LoadBalancerDnsName`,
        });

        new cdk.CfnOutput(this, "CfnOutputQBusinessChatRole", {
            value: qbusinessChatRole.roleArn,
            description: "The DNS name of the Application Load Balancer for the Strands Agent",
            exportName: 'QBusinessChatRole',
        });

        new cdk.CfnOutput(this, "BackendStackHttpEndpointURL", {
            value: `http://${lb.loadBalancerDnsName}`,
            description: "The HTTP URL of the Application Load Balancer for the Strands Agent",
            exportName: `${projectId.valueAsString}-HttpLoadBalancerUrl`,
        });
    }

    createBedrockQueryEvalRole(projectId: string){
        const qbusinessQueryEvalRole = new iam.Role(this, "QBusinessQueryEvalRole", {
            assumedBy: new iam.ServicePrincipal("bedrock.amazonaws.com"),
            roleName: `${projectId}-qbusiness-query-eval`,
        });

        qbusinessQueryEvalRole.addToPolicy(
            new iam.PolicyStatement({
                actions: [
                    "bedrock:*",
                    "s3:*",
                ],
                resources: ["*"],
            })
        );
        return qbusinessQueryEvalRole
    }

    createFargateTaskRole(projectId: string, qbusinessQueryEvalRole: Role, userSessionTable: Table){
        const taskRole = new iam.Role(this, "BackendStackTaskRole", {
            assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
            roleName: `${projectId}-task-role`,
        });
        // Add Bedrock permissions to task role
        taskRole.addToPolicy(
            new iam.PolicyStatement({
                actions: [
                    "logs:*",
                    "sso-oauth:*",
                    "sts:*"
                ],
                resources: ["*"],
            })
        );

        taskRole.addToPolicy(
            new iam.PolicyStatement({
                actions: [
                    "qbusiness:ListApplications",
                    "qbusiness:ListDataSources",
                    "qbusiness:ListDataSourceSyncJobs",
                    "qbusiness:ListIndices",
                    "qbusiness:ListPlugins",
                    "qbusiness:ListRetrievers",
                    "qbusiness:GetDataSource",
                    "qbusiness:GetPlugin",
                    "qbusiness:GetRetriever"
                ],
                resources: ["*"],
            })
        );

        taskRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['iam:PassRole'],
            resources: [qbusinessQueryEvalRole.roleArn],
        }));

        taskRole.addToPolicy(
            new iam.PolicyStatement({
                actions: [
                    "dynamodb:PutItem",
                    "dynamodb:GetItem",
                    "dynamodb:ListTables",
                ],
                resources: [userSessionTable.tableArn],
            })
        );

        taskRole.addToPolicy(
            new iam.PolicyStatement({
                actions: [
                    "secretsmanager:GetSecretValue",
                ],
                resources: ['*'],
            })
        );

        taskRole.addToPolicy(
            new iam.PolicyStatement({
                actions: [
                    "bedrock:GetEvaluationJob",
                    "bedrock:ListEvaluationJobs",
                    "bedrock:CreateEvaluationJob",
                ],
                resources: ['*'],
            })
        );

        taskRole.addToPolicy(
            new iam.PolicyStatement({
                actions: [
                    "s3:PutObject",
                    "s3:GetObject",
                    "s3:CreateBucket",
                    "s3:ListBucket",
                    "s3:PutBucketCORS",
                ],
                resources: ['*'],
            })
        );
        return taskRole
    }

    createQBusinessChatRole(projectId: string, fargateTaskRole: Role){
        const qbusinessChatRole = new iam.Role(this, "QBusinessChatRole", {
            assumedBy: new iam.CompositePrincipal(
                new iam.ServicePrincipal('qbusiness.amazonaws.com')
            ),
            roleName: `${projectId}-qbusiness-chat-role`,
        });

        qbusinessChatRole.assumeRolePolicy?.addStatements(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                principals: [
                    new iam.ServicePrincipal('qbusiness.amazonaws.com'),
                    new iam.ArnPrincipal(fargateTaskRole.roleArn),
                    new iam.AccountPrincipal(process.env.CDK_DEFAULT_ACCOUNT)
                ],
                actions: ['sts:AssumeRole', 'sts:SetContext'],
            })
        );
        qbusinessChatRole.grantAssumeRole(fargateTaskRole)
        qbusinessChatRole.addToPolicy(
            new iam.PolicyStatement({
                actions: [
                    "qbusiness:ChatSync",
                    "qbusiness:ListMessages",
                    "qbusiness:ListConversations",
                    "qbusiness:DeleteConversation",
                    "qbusiness:GetMedia",
                    "qbusiness:Chat",
                    "qbusiness:SearchRelevantContent"
                ],
                resources: ["*"],
            })
        );
        return qbusinessChatRole;
    }

    createQBusinessAnonymousAccessRole(projectId: string ){
        const qbusinessAnonymousAccessRole = new iam.Role(this, "QBusinessAnonymousAccessRole", {
            assumedBy: new iam.CompositePrincipal(
                new iam.ServicePrincipal('qbusiness.amazonaws.com'),
                new iam.ServicePrincipal('edgelambda.amazonaws.com')
            ),
            roleName: `${projectId}-qbusiness-anonymous-access-role`,
        });

        qbusinessAnonymousAccessRole.addToPolicy(
            new iam.PolicyStatement({
                actions: [
                    "qbusiness:ChatSync",
                    "qbusiness:ListMessages",
                    "qbusiness:ListConversations",
                    "qbusiness:DeleteConversation",
                    "qbusiness:GetMedia",
                    "qbusiness:Chat",
                    "qbusiness:SearchRelevantContent"
                ],
                resources: ["*"],
            })
        );
        return qbusinessAnonymousAccessRole;

    }

    createUserSessionTable(){
        return new dynamodb.Table(this, 'UserSessionTable', {
            tableName: 'UserSession',
            partitionKey: {
                name: 'sessionId',
                type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 5,
            writeCapacity: 5,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // For development; use RETAIN for production
        });
    }
}
