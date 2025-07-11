# QBusiness Tools Backend (TypeScript)

This is a TypeScript implementation of the QBusiness Tools backend, converted from the original Python FastAPI implementation.

## Features

- NestJS framework with TypeScript
- AWS SDK v3 integration
- API endpoints for QBusiness operations
- Environment variable configuration
- Docker support

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- AWS credentials configured

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# AWS Region
AWS_REGION=us-east-1

# Server Port
PORT=8000

# Required for Bedrock query evaluation
BEDROCK_QUERY_EVAL_ROLE_ARN=

# Required for anonymous access to QBusiness
QBUSINESS_ANONYMOUS_ACCESS_ROLE_ARN=

# Required for authenticated access to QBusiness
IDENTITY_CENTER_APPLICATION_ID=
IDENTITY_CENTER_APPLICATION_ROLE_ARN=
```

## Installation

```bash
# Install dependencies
npm install

# Development mode
npm run start:dev

# Production build
npm run build
npm run start:prod
```

## Docker

```bash
# Build Docker image
docker build -t qbusiness-backend .

# Run Docker container
docker run -p 8000:8000 qbusiness-backend
```

## API Endpoints

- `GET /api/health`: Health check endpoint
- `GET /api/applications`: List all QBusiness applications
- `GET /api/applications/:applicationId/indices`: List indices for a specific application
- `GET /api/applications/:applicationId/plugins`: List plugins for a specific application
- `GET /api/applications/:applicationId/indices/:indexId/datasources`: List data sources for a specific index
- `GET /api/applications/:applicationId/indices/:indexId/datasources/:dataSourceId/syncjobs`: List sync jobs for a specific data source
- `GET /api/applications/:applicationId/indices/:indexId/datasources/:dataSourceId/syncjobs/:syncJobId/metrics`: Get metrics for a specific sync job
- `GET /api/applications/:applicationId/search`: Search for relevant content
- `POST /api/applications/:applicationId/check-access`: Check if a user has access to a specific document

## Project Structure

```
ts/backend/
├── src/
│   ├── controllers/       # API controllers
│   ├── services/          # Business logic
│   ├── app.module.ts      # Main module
│   └── main.ts            # Application entry point
├── .env                   # Environment variables
├── Dockerfile             # Docker configuration
└── package.json           # Dependencies and scripts
```

## Differences from Python Implementation

- Uses NestJS instead of FastAPI
- AWS SDK v3 instead of boto3
- TypeScript interfaces for type safety
- Dependency injection for services
