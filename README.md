# Simple Label Maker

A simple containerized and Azure-backed data labeling solution inspired by Label Studio. Designed to run on Azure behind Azure B2C authentication.

## Features

- **TypeScript Web Application**: Modern, responsive UI for data labeling
- **Azure Blob Storage Integration**: Retrieve samples and store annotations in Azure Blob Storage
- **Configurable Labeling Interface**: Define your labeling schema via `UI.xml`
- **Azure B2C Authentication Ready**: Built-in support for Azure AD B2C authentication
- **Docker Containerized**: Easy deployment with Docker and docker-compose
- **Multiple Data Types**: Support for images, text, audio, and video
- **Keyboard Shortcuts**: Fast labeling with configurable hotkeys
- **Progress Tracking**: Visual progress bar and annotation counting

## Quick Start

### Prerequisites

- Node.js 18+ (for development)
- Docker (for containerized deployment)

### Development Mode

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open http://localhost:3000 in your browser

### Docker Deployment

1. Build and run with Docker Compose:
```bash
docker-compose up --build
```

2. Or build and run manually:
```bash
docker build -t simple-label-maker .
docker run -p 3000:3000 simple-label-maker
```

## Configuration

### Project Configuration (`config/project.json`)

```json
{
  "projectId": "my-project",
  "projectName": "My Labeling Project",
  "description": "Project description shown to annotators",
  "azureStorage": {
    "accountName": "your-storage-account",
    "containerName": "labeling-data",
    "dataPath": "samples",
    "annotationsPath": "annotations"
  },
  "authentication": {
    "azureB2C": {
      "tenantId": "your-tenant-id",
      "clientId": "your-client-id",
      "authority": "https://your-tenant.b2clogin.com/...",
      "redirectUri": "http://localhost:3000/auth/callback",
      "scopes": ["openid", "profile", "email"]
    }
  },
  "samples": [
    {
      "id": "sample-001",
      "fileName": "image1.jpg",
      "type": "image",
      "metadata": {}
    }
  ]
}
```

### UI Schema (`config/UI.xml`)

Define your labeling interface using XML:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<LabelingInterface title="Image Classification" description="Classify images">
  <DataSource type="image" field="imageUrl" />
  
  <Labels>
    <Label name="category" type="choices" required="true">
      <Option value="cat" label="Cat" hotkey="1" color="#FF5733" />
      <Option value="dog" label="Dog" hotkey="2" color="#33FF57" />
    </Label>
    
    <Label name="quality" type="rating" min="1" max="5" />
    
    <Label name="notes" type="text-input" />
  </Labels>
  
  <Layout columns="1" showProgress="true" showInstructions="true" />
</LabelingInterface>
```

### Supported Data Source Types

| Type | Description |
|------|-------------|
| `image` | Image files (jpg, png, etc.) |
| `text` | Text documents |
| `audio` | Audio files |
| `video` | Video files |
| `time-series` | Multi-timeseries data (JSON arrays) |

### Supported Label Types

- `choices` / `classification`: Single or multi-select options
- `rating`: Star rating (1-5 or custom range)
- `text-input`: Free-form text input
- `time-series`: Multi-timeseries annotation with per-series labels, global classification, and comments
- `bounding-box`: Draw bounding boxes on images (planned)
- `polygon`: Draw polygons on images (planned)

### Time-Series Label Configuration

For multi-timeseries annotation, use the `time-series` label type. This supports:
- Visualizing multiple time series with Chart.js
- Per-series classification labels
- Global sample classification
- Comment/observation field
- Configurable y-axis min/max

Example configuration:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<LabelingInterface title="ECG Classification" description="Classify ECG time series">
  <DataSource type="time-series" field="seriesData" />
  
  <Labels>
    <Label name="ecg" type="time-series" count="10" required="true" 
           globalLabel="Sample Classification" commentLabel="Observations">
      <Axis min="-1" max="1" />
      <SeriesOptions>
        <Option value="AF" label="Atrial Fibrillation" color="#FF5733" />
        <Option value="Noise" label="Noise" color="#FFC300" />
        <Option value="None" label="None (Unlabeled)" color="#C0C0C0" />
      </SeriesOptions>
      <GlobalOptions>
        <Option value="AF" label="AF" hotkey="a" color="#FF5733" />
        <Option value="nonAF" label="Non-AF" hotkey="n" color="#33FF57" />
      </GlobalOptions>
    </Label>
  </Labels>
  
  <Layout columns="1" showProgress="true" showInstructions="true" />
</LabelingInterface>
```

#### Time-Series Label Attributes

| Attribute | Description | Default |
|-----------|-------------|---------|
| `count` | Number of time series per sample | 10 |
| `globalLabel` | Label text for global classification section | "Sample Classification" |
| `commentLabel` | Label text for comment field | "Comments/Observations" |

#### Child Elements

- `<Axis min="" max="" />`: Y-axis configuration for charts
- `<SeriesOptions>`: Label options for per-series classification
- `<GlobalOptions>`: Label options for global sample classification

#### Time-Series Annotation Format

```json
{
  "labelName": {
    "seriesLabels": {
      "series_0": "AF",
      "series_1": "Noise",
      "series_2": "None"
    },
    "globalLabel": "AF",
    "comment": "Sample shows clear AF pattern in series 0"
  }
}
```

## Azure Setup

### Azure Blob Storage

1. Create an Azure Storage Account
2. Create a container for your labeling project
3. Upload your samples to the `samples` folder
4. Set the connection string as an environment variable:

```bash
export AZURE_STORAGE_CONNECTION_STRING="your-connection-string"
```

### Annotation Syncing to Azure

When Azure Storage is configured, all annotations are automatically synced to Azure Blob Storage with full user tracking:

- **User ID**: Unique identifier from Azure B2C
- **User Email**: Email address from Azure credentials
- **User Name**: Display name from Azure profile
- **Azure Object ID**: Azure AD object ID for precise user tracking
- **Tenant ID**: Azure AD tenant for multi-tenant scenarios
- **Timestamp**: When the annotation was created

Annotations are stored as JSON files at:
```
{annotationsPath}/{sampleId}_{userId}.json
```

Example annotation structure:
```json
{
  "id": "uuid-v4",
  "sampleId": "sample-001",
  "userId": "user-azure-id",
  "userEmail": "user@example.com",
  "userName": "John Doe",
  "azureObjectId": "azure-object-id",
  "tenantId": "tenant-id",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "labels": { "category": "cat", "quality": 5 },
  "status": "submitted"
}
```

### Azure B2C Authentication

1. Create an Azure AD B2C tenant
2. Register your application
3. Create user flows (sign-up/sign-in)
4. Update the `authentication` section in `project.json`

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3000) | No |
| `AZURE_STORAGE_CONNECTION_STRING` | Azure Blob Storage connection string | For Azure mode |
| `CONFIG_PATH` | Custom path to project.json | No |
| `UI_XML_PATH` | Custom path to UI.xml | No |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/project` | GET | Get project information |
| `/api/ui-schema` | GET | Get UI schema |
| `/api/samples` | GET | List all samples |
| `/api/samples/:id` | GET | Get sample details |
| `/api/samples/:id/data` | GET | Get sample data/URL |
| `/api/annotations/:sampleId` | GET | Get annotation for current user |
| `/api/annotations/:sampleId/all` | GET | List all annotations with user tracking |
| `/api/annotations` | POST | Save annotation (syncs to Azure with user info) |
| `/api/stats` | GET | Get project statistics |
| `/api/navigation/:sampleId` | GET | Get navigation info |
| `/health` | GET | Health check endpoint |

## Keyboard Shortcuts

- `1-9`: Select corresponding label option
- `Ctrl + Enter`: Submit annotation
- `Alt + Left`: Previous sample
- `Alt + Right`: Next sample

## Project Structure

```
simple-label-maker/
├── src/
│   ├── index.ts           # Express server entry point
│   ├── routes/
│   │   └── api.ts         # API routes
│   ├── services/
│   │   ├── azureStorage.ts    # Azure Blob Storage integration
│   │   ├── configService.ts   # Configuration management
│   │   └── uiSchemaParser.ts  # UI.xml parser
│   └── types/
│       └── index.ts       # TypeScript type definitions
├── public/
│   ├── index.html         # Main HTML template
│   ├── css/
│   │   └── styles.css     # Application styles
│   └── js/
│       └── app.js         # Frontend JavaScript
├── config/
│   ├── project.json       # Project configuration
│   └── UI.xml             # Labeling interface schema
├── Dockerfile             # Docker build file
├── docker-compose.yml     # Docker Compose configuration
├── package.json           # Node.js dependencies
└── tsconfig.json          # TypeScript configuration
```

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.
