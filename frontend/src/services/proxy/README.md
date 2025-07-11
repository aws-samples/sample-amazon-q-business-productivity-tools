# QBusiness Proxy Service

This directory contains proxy services that communicate with the backend API endpoints exposed in `/backend/app/app.py`.

## QBusinessProxyService

The `QBusinessProxyService` is a TypeScript service that proxies requests to the QBusiness backend API. It provides a clean interface for frontend components to interact with the backend without directly dealing with HTTP requests.

### Features

- Singleton pattern for efficient resource usage
- Error handling and consistent response format
- TypeScript interfaces that match backend API responses
- Uses native Fetch API for HTTP requests

### Available Methods

- `checkHealth()`: Checks the health of the backend service
- `listApplications()`: Lists all QBusiness applications
- `listIndices(applicationId)`: Lists indices for a specific application
- `listDataSources(applicationId, indexId)`: Lists data sources for a specific index
- `listDataSourceSyncJobs(applicationId, indexId, dataSourceId)`: Lists sync jobs for a specific data source
- `getSyncJobMetrics(applicationId, indexId, dataSourceId, syncJobId)`: Gets metrics for a specific sync job

### Usage Example

```typescript
import { qBusinessProxyService } from '../services';

// Using the singleton instance
async function fetchApplications() {
  const result = await qBusinessProxyService.listApplications();
  
  if (result.success) {
    // Handle successful response
    console.log('Applications:', result.data);
  } else {
    // Handle error
    console.error('Error:', result.error.message);
  }
}
```

### Response Format

All methods return a `ServiceResult<T>` object with the following structure:

```typescript
{
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    statusCode: number;
  };
}
```

This consistent format makes it easy to handle both successful responses and errors in a uniform way.
