# Simple Label Maker

A simple containerized and Azure-backed data labeling solution inspired by Label Studio. Designed to run on Azure behind Azure B2C authentication.

📖 **[View Full Documentation](https://raca159.github.io/simple-label-maker/)**

## Features

- **TypeScript Web Application**: Modern, responsive UI for data labeling
- **Azure Blob Storage Integration**: Retrieve samples and store annotations in Azure Blob Storage
- **Configurable Labeling Interface**: Define your labeling schema via `UI.xml`
- **Azure B2C Authentication Ready**: Built-in support for Azure AD B2C authentication
- **Docker Containerized**: Easy deployment with Docker and docker-compose
- **Multiple Data Types**: Support for images, text, audio, and video
- **Keyboard Shortcuts**: Fast labeling with configurable hotkeys
- **Progress Tracking**: Visual progress bar and annotation counting
- **Ready-to-Use Templates**: Pre-built XML templates for common labeling tasks

## Documentation

- [Getting Started](docs/index.md) - Overview and quick start
- [Labeling Schemas Guide](docs/labeling-schemas.md) - Complete UI.xml reference
- [Templates Guide](docs/templates.md) - Ready-to-use template documentation
- [Custom Schemas Guide](docs/custom-schemas.md) - Create your own labeling interfaces

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
  "sampleControl": {
    "disableSkip": false,
    "disablePrevious": false,
    "disableNext": false,
    "filterAnnotatedSamples": false,
    "requireSubmitToNavigate": false
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

### Sample Control Configuration

The `sampleControl` object allows you to control navigation behavior and sample filtering:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `disableSkip` | boolean | `false` | Hides the Skip button, preventing users from skipping samples |
| `disablePrevious` | boolean | `false` | Hides the Previous button, preventing navigation to previously viewed samples |
| `disableNext` | boolean | `false` | Hides the Next button, preventing forward navigation without submitting |
| `filterAnnotatedSamples` | boolean | `false` | Filters out already-annotated samples, showing only remaining work |

#### Use Cases

**Prevent Sample Cross-Influence**: Set `disableSkip`, `disablePrevious`, and `disableNext` all to `true` to ensure each sample is viewed only once, preventing one sample from influencing the labeling of another.

```json
{
  "sampleControl": {
    "disableSkip": true,
    "disablePrevious": true,
    "disableNext": true,
    "filterAnnotatedSamples": true
  }
}
```

**Resume Labeling Sessions**: Set `filterAnnotatedSamples` to `true` so users can stop labeling, return later, and automatically continue from where they left off. The progress bar shows "11/100" style progress indicating completed samples out of total.

### External Task Files

You can load samples from an external JSON file instead of defining them inline in `project.json`. This is useful for:
- Managing large sample lists separately
- Migrating from Label Studio or other tools
- Dynamically generating sample lists

#### Using External Task Files

To use an external task file, add a `sampleTask` field to your `project.json`:

```json
{
  "projectId": "my-project",
  "projectName": "My Labeling Project",
  "description": "Project description",
  "azureStorage": { ... },
  "authentication": { ... },
  "sampleTask": {
    "fileName": "samples.json"
  },
  "samples": []
}
```

The `fileName` can be:
- A relative path (resolved from the `config/` directory): `"samples.json"`
- An absolute path: `"/path/to/samples.json"`

When `sampleTask` is specified, the `samples` array in `project.json` is ignored.

#### Task File Format

The external task file should be a JSON array of sample objects:

```json
[
  {
    "id": "sample-001",
    "fileName": "https://example.blob.core.windows.net/data/sample.001.csv",
    "type": "time-series",
    "metadata": {
      "channelCount": 10
    }
  },
  {
    "id": "sample-002",
    "fileName": "data/sample.002.jpg",
    "type": "image"
  }
]
```

#### Migrating from Label Studio

If you're migrating from Label Studio, you can use the included migration script to convert Label Studio task files to Simple Label Maker format:

```bash
python3 scripts/migrate_from_label_studio.py \
  --task label_studio_tasks.json \
  --type time-series \
  --metadata '{"channelCount": 10}' \
  --output config/samples.json
```

**Arguments:**
- `--task`: Path to your Label Studio task JSON file
- `--type`: Sample type to apply to all samples (`image`, `text`, `audio`, `video`, `time-series`)
- `--metadata`: JSON string of metadata to apply to all samples (optional)
- `--output`: Output file path (default: `samples.json`)
- `--data-field`: Specific data field to extract (e.g., `csv_url`). If not specified, uses the first data field found.

**Label Studio Task Format Example:**

```json
[
  [
    {
      "id": "task_0",
      "data": {
        "csv_url": "https://storage.blob.core.windows.net/data/sample.1772.csv"
      }
    }
  ],
  [
    {
      "id": "task_1",
      "data": {
        "csv_url": "https://storage.blob.core.windows.net/data/sample.968.csv"
      }
    }
  ]
]
```

After migration, update your `project.json` to use the generated task file:

```json
{
  "sampleTask": {
    "fileName": "samples.json"
  },
  "samples": []
}
```

### UI Schema (`config/UI.xml`)

Define your labeling interface using XML. You can start with one of the pre-built templates:

```bash
# Use a template for your labeling task
cp config/templates/image-classification.xml config/UI.xml
```

#### Available Templates

| Template | Data Type | Use Case |
|----------|-----------|----------|
| `image-classification.xml` | Image | Classify images into categories |
| `text-sentiment.xml` | Text | Sentiment analysis of text |
| `audio-classification.xml` | Audio | Classify audio content |
| `video-annotation.xml` | Video | Annotate video content |
| `time-series-ecg.xml` | Time-Series | ECG/medical signal classification |
| `time-series-sensor.xml` | Time-Series | IoT/sensor data classification |
| `multi-label-classification.xml` | Image | Multiple labels per image |
| `bounding-box.xml` | Image | Object detection (planned) |

See the [Templates Guide](docs/templates.md) for detailed documentation on each template.

#### Example Schema

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
export STORAGE_CONN_STR="your-connection-string"
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
| `STORAGE_CONN_STR` | Azure Blob Storage connection string | For Azure mode |
| `CONFIG_PATH` | Custom path to project.json | No |
| `UI_XML_PATH` | Custom path to UI.xml | No |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/project` | GET | Get project information and sample control settings |
| `/api/ui-schema` | GET | Get UI schema |
| `/api/samples` | GET | List all samples |
| `/api/samples/filtered` | GET | Get samples filtered by user's annotations (when filtering enabled) |
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
│   ├── UI.xml             # Active labeling interface schema
│   └── templates/         # Ready-to-use schema templates
│       ├── image-classification.xml
│       ├── text-sentiment.xml
│       ├── audio-classification.xml
│       ├── video-annotation.xml
│       ├── time-series-ecg.xml
│       ├── time-series-sensor.xml
│       ├── multi-label-classification.xml
│       └── bounding-box.xml
├── docs/                  # Documentation (GitHub Pages)
│   ├── _config.yml        # Jekyll configuration
│   ├── index.md           # Documentation home
│   ├── labeling-schemas.md
│   ├── templates.md
│   └── custom-schemas.md
├── Dockerfile             # Docker build file
├── docker-compose.yml     # Docker Compose configuration
├── package.json           # Node.js dependencies
└── tsconfig.json          # TypeScript configuration
```

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.
