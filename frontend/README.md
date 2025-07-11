# Amazon Q Business Tools

A comprehensive suite of tools for monitoring, analyzing, and enhancing your Amazon Q Business experience. This application provides administrators and developers with powerful capabilities to troubleshoot observability issues, manage data sources, evaluate performance, and interact with Amazon Q Business services.

## Purpose and Intention

Amazon Q Business Tools was built to help users troubleshoot observability-related issues with Amazon Q Business data source connectors. It provides a unified interface for:

- Monitoring and analyzing CloudWatch logs emitted by data source connectors
- Checking document access permissions
- Visualizing group memberships and ACLs
- Evaluating search and chat performance
- Interacting with Amazon Q Business through search and chat interfaces

## High-Level Architecture

The application is built as a React single-page application (SPA) with the following components:

- **Frontend**: React with TypeScript, using modern React patterns and hooks
- **Service Layer**: Modular services for interacting with AWS services
- **Authentication**: Support for AWS credentials and IDP authentication
- **Tools**: Multiple specialized tools for different aspects of Amazon Q Business

The application follows a modular architecture with:

1. **Components**: UI components organized by feature
2. **Services**: Service layer for AWS API interactions
3. **Utils**: Utility functions for common operations
4. **Types**: TypeScript type definitions
5. **Config**: Application configuration

## Prerequisites

To use this application, you need:

1. **AWS Account** with access to Amazon Q Business
2. **AWS Credentials** (Access Key ID, Secret Access Key, and optionally Session Token)
3. **Amazon Q Business Application** set up with at least one index and data source
4. **Node.js** and **npm** installed on your development machine
5. **Modern web browser** (Chrome, Firefox, Edge, or Safari)

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

## How to Run the Application

In the project directory, you can run:

```bash
npm start
```

This runs the app in development mode. Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes. You may also see any lint errors in the console.

## Getting Started: Configuration and Setup Process

When you first launch the application, you'll be guided through a comprehensive step-by-step setup process:

### 1. AWS Credentials Setup

The first step is to configure your AWS credentials:

- **Access Key ID**: Enter your AWS Access Key ID (20 characters, uppercase letters and numbers)
- **Secret Access Key**: Enter your AWS Secret Access Key (at least 40 characters)
- **Session Token (optional)**: Required only for temporary credentials
- **Region**: Select your AWS region (e.g., us-east-1)

Your credentials are stored securely in your browser's local storage and are used to authenticate with AWS services. The application validates these credentials by making a test API call to ensure they're working correctly before proceeding.

![AWS Credentials Setup](docs/images/aws_credentials_setup.png)

### 2. Application Configuration

After setting up AWS credentials, you'll need to configure your Amazon Q Business or Kendra resources:

1. **Choose Configuration Type**: Select either QBusiness or Kendra
2. **For QBusiness Configuration**:
   - **Select Application**: Choose your QBusiness Application from the dropdown
   - **Select Index**: Choose the index you want to work with
   - **Select Data Source**: Choose the data source you want to analyze
   - **Select Sync Job (Optional)**: Choose a specific sync job to analyze
3. **For Kendra Configuration**:
   - **Select Index**: Choose the Kendra index you want to work with
   - **Select Data Source**: Choose the data source you want to analyze
   - **Select Sync Job (Optional)**: Choose a specific sync job to analyze

The application will automatically load and populate these dropdowns based on the resources available in your AWS account. If there's only one option available for any selection (e.g., only one application or index), it will be automatically selected.

![Application Configuration](docs/images/qbusiness%20or%20kendra%20configuration.png)

### 3. Setup Decision

After configuring your application, you'll be presented with a decision screen:

- **Start Using Operations Dashboard**: This option allows you to immediately start using the Operations Dashboard with just AWS credentials. This is sufficient if you only need to monitor and troubleshoot data source connectors.
- **Continue Setup for Advanced Features**: This option guides you through additional authentication setup for advanced features like Unified Search, ChatBot, and Ground Truth Evaluation.

![Setup Decision](docs/images/operations%20or%20chat%20decision.png)

### 4. IDP Authentication Setup (Optional)

If you choose to continue setup for advanced features, you'll need to select an authentication provider:

- **Amazon Cognito**: Use Amazon Cognito User Pools for authentication. The application will automatically list available User Pools in your AWS account.
- **Microsoft Entra**: Use Microsoft Entra ID (formerly Azure Active Directory) for authentication. You'll need to provide your tenant ID and configure the application with the appropriate permissions.
- **Anonymous Access**: Use anonymous access with an IAM Role for invoking ChatSync API and Relevant Content API. This option requires you to enter an IAM Role ARN that has the necessary permissions.

Each authentication option has specific requirements:

#### Amazon Cognito Setup
- Select a User Pool from your AWS account
- Configure the User Pool client settings
- The application will handle the authentication flow

#### Microsoft Entra Setup
- Enter your Microsoft Entra Tenant ID
- Configure the application in your Microsoft Entra portal
- Provide the necessary redirect URIs

#### Anonymous Access Setup
- Enter an IAM Role ARN that has permissions to invoke the required APIs
- This role will be assumed when making API calls

After authentication, you'll need to select an SSO OIDC application (except for Anonymous access) that will be used to exchange ID tokens for AWS credentials.

![IDP Authentication Setup](docs/images/IDP%20flow.png)

### 5. Application Configuration (Final Step)

The final step is to configure the application settings for the advanced features. This includes selecting the QBusiness or Kendra resources that will be used for Unified Search, ChatBot, and Ground Truth Evaluation.

### 6. Complete Configuration

After completing the setup process, you'll have access to all the tools based on your authentication level:

- With AWS credentials only: Operations Dashboard
- With full authentication: All tools including Unified Search, ChatBot, and Ground Truth Evaluation

Your configuration is saved in your browser's local storage, so you won't need to go through the setup process again unless you clear your browser data or want to change your configuration.

You can always reconfigure your settings by clicking the gear icon in the application.

> **Note**: The screenshots above are for illustration purposes. The actual interface may vary slightly depending on the version of the application.

## Available Tools

### Setup

Streamlined setup flow that guides you through AWS credentials and App Config. You can choose to continue with IDP authentication if you need advanced features.

### Operations Dashboard

Monitor, analyze, and troubleshoot your Amazon Q Business data source sync jobs with powerful insights and visualizations. This tool requires only AWS credentials.

![Operations Dashboard](docs/images/Operations%20Dashboard%20landing%20page.png)

The Operations Dashboard includes the following tabs:

#### Sync Metrics

This tab shows metrics emitted in CloudWatch for the configured application and the last sync run. It provides insights into the performance and health of your sync jobs.

#### Group Membership

This tab shows all the groups that were crawled during the Identity Crawling phase of the connector run. When Identity Crawler runs, the connector fetches all the groups present in the data source. For each local group, identity crawler also fetches the members of the group. Use this information to understand what groups were crawled during the identity crawler phase.

#### ACL Viewer

This tab allows you to visualize all the documents that were crawled during the last sync run. For each document, it lists all the ACLs associated with it. ACLs might include:
- Local Groups
- Global Groups
- Users

Use this information to troubleshoot if a document should be visible to a particular user or a local/global group.

![ACL Viewer](docs/images/ACL%20Viewer.png)

#### Permission Checker

This tab allows you to check if a given document can be accessed by a provided user. This tab makes use of the check-document-access API, which provides information about whether a user should have access to a document. When the tab is loaded, it lists all the documents that were crawled in the last sync. If you provide the user email ID and select a particular document, this tab will query the check-document-access API and list the access information.

#### Sync Errors

This tab shows all the sync errors during the last configured sync. It lists all the errors, status codes, and possible reasons, helping you troubleshoot issues with your data source connectors.

### Unified Search

Search for content with an integrated Generative AI assistant to help you find exactly what you need. This tool requires full authentication through one of the IDP authentication methods (Microsoft Entra, Anonymous Access, or Cognito when available).

![Unified Search](docs/images/UnifiedSearch.png)

### AI Chat Bot

Chat with an AI assistant using customizable data sources to get intelligent, context-aware responses. This tool requires full authentication through one of the IDP authentication methods (Microsoft Entra, Anonymous Access, or Cognito when available).

The AI Chat Bot allows you to select either plugins or data sources to enhance your chat experience:
- **Plugins**: Extend the functionality of the chat bot with specialized capabilities
- **Data Sources**: Connect to your organization's data to provide context-aware responses

Note that plugins and data sources cannot be used simultaneously - you must choose one or the other for each chat session.

![AI Chat Bot](docs/images/ChatBot.png)

### Ground Truth Evaluation

Evaluate Q Business performance against ground truth datasets with an intuitive interface. This tool requires full authentication through one of the IDP authentication methods (Microsoft Entra, Anonymous Access, or Cognito when available).

![Ground Truth Evaluation](docs/images/GroundTruthEvaluation.png)

## Service Layer

The application includes a comprehensive service layer for interacting with various AWS services:

- **QBusinessService**: Handles interactions with Amazon Q Business
- **BedrockService**: Provides functionality for Amazon Bedrock
- **S3Service**: Manages interactions with Amazon S3
- **CloudWatchService**: Handles CloudWatch logs and metrics
- **IdentityCenterService**: Manages AWS Identity Center operations
- **AuthService**: Provides authentication functionality
- **KendraService**: Handles interactions with Amazon Kendra

## Troubleshooting

If you encounter issues:

1. Check your AWS credentials and permissions
2. Verify your Amazon Q Business application, index, and data source IDs
3. Ensure your sync job ID is correct
4. Check the browser console for error messages
5. Verify network connectivity to AWS services

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
