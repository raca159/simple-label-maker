# Development Mode with Mock Authentication

This guide explains how to set up the application for local development with mock authentication and Azure Blob Storage.

## Prerequisites

- Node.js 18+
- Azure Storage account with connection string
- npm installed

## Setup

### 1. Create a `.env` file

Copy `.env.example` to `.env` and update with your Azure credentials:

```bash
cp .env.example .env
```

Edit `.env` and add your Azure Storage connection string:

```env
STORAGE_CONN_STR=DefaultEndpointsProtocol=https;AccountName=your-account;AccountKey=your-key;EndpointSuffix=core.windows.net

MOCK_AUTH=true
MOCK_USER_ID=dev-user-001
MOCK_USER_EMAIL=dev-user@example.com
MOCK_USER_NAME=Dev User

PORT=3000
DEBUG_HEADERS=false
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run in Development Mode with Mock Auth

```bash
npm run dev:mock
```

This will:
- Enable mock authentication (no Azure B2C required)
- Load environment variables from `.env`
- Start the dev server with hot reload on file changes
- Use the user ID from `MOCK_USER_ID` for all requests

The application will be available at `http://localhost:3000`

## How Mock Authentication Works

When `MOCK_AUTH=true` is set in your `.env`, the server will:

1. Extract authentication from environment variables instead of Azure B2C headers
2. Create a mock user object with the following properties:
   - `userId`: From `MOCK_USER_ID` env var (default: `dev-user-001`)
   - `email`: From `MOCK_USER_EMAIL` env var
   - `name`: From `MOCK_USER_NAME` env var
   - `azureObjectId`: Same as `userId`
   - `identityProvider`: Set to `'mock'`

This mock user is then used throughout the application for:
- Storing annotations in Azure Blob Storage
- Tracking which samples have been annotated
- Resume functionality (resume from where user left off)

## Testing Resume Functionality

The resume functionality works as follows:

1. **First visit**: Start labeling samples. Progress shows `1/100`, `2/100`, etc.
2. **Close and reopen**: When you return to the app, it will:
   - Query `/api/resume-position` endpoint
   - Check which samples have been annotated in Azure Blob Storage
   - Load the next unfinished sample automatically
   - Display correct progress (e.g., `11/100`)

### Manual Testing Steps

1. Start the dev server:
   ```bash
   npm run dev:mock
   ```

2. Navigate to `http://localhost:3000`

3. Annotate a few samples and submit each one

4. Close the browser tab

5. Open `http://localhost:3000` again (don't use browser back/forward)

6. The application should:
   - Load the sample after the ones you completed
   - Show correct progress count
   - Have your annotations preserved in Azure Blob Storage

## Different Mock Users

To test with different users, modify your `.env`:

```env
# User 1
MOCK_USER_ID=alice-001
MOCK_USER_EMAIL=alice@dev.local
MOCK_USER_NAME=Alice

# Then restart the server
```

Each user ID will have its own separate annotation history in Azure Blob Storage.

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `MOCK_AUTH` | `false` | Enable mock authentication |
| `MOCK_USER_ID` | `dev-user-001` | User ID for mock authentication |
| `MOCK_USER_EMAIL` | `dev-user@example.com` | Email for mock user |
| `MOCK_USER_NAME` | `Dev User` | Display name for mock user |
| `STORAGE_CONN_STR` | (required) | Azure Blob Storage connection string |
| `PORT` | `3000` | Server port |
| `DEBUG_HEADERS` | `false` | Log all request headers for debugging |

## Troubleshooting

### "STORAGE_CONN_STR not set" Error

Make sure you've:
1. Created a `.env` file in the project root
2. Added your Azure Storage connection string
3. Restarted the dev server (it loads .env on startup)

### Annotations Not Persisting

Check that:
1. Your `STORAGE_CONN_STR` is correct
2. Azure Blob Storage is accessible from your machine
3. The container name in `config/project.json` matches your Azure container

### Resume Not Working

Verify that:
1. Mock auth is enabled (`MOCK_AUTH=true`)
2. User ID is consistent (same `MOCK_USER_ID` on reload)
3. Annotations are being saved (check for success toast after submission)
4. Check browser console for any API errors

## Architecture

```
Mock Request
    ↓
mockAuthMiddleware (creates user object from env vars)
    ↓
requestHandler
    ↓
API Endpoint (uses req.user for userId)
    ↓
Azure Blob Storage (annotations stored with userId path)
    ↓
Resume: /api/resume-position
    ↓
Returns next unfinished sample based on stored annotations
```

## Production Deployment

For production, remove mock authentication:

1. Set `MOCK_AUTH=false` or don't set it (defaults to false)
2. Configure Azure B2C authentication via headers
3. Deploy with Azure Container Apps or similar service
4. The application will expect authentication headers from Azure B2C

See the main README.md for production setup instructions.
