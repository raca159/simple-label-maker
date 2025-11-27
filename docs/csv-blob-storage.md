# CSV and Blob Storage Support

## Overview

Simple Label Maker now supports loading time-series data from CSV files hosted on Azure Blob Storage. The system automatically parses CSV files and converts them to the internal time-series format.

## CSV Format

CSV files should have the following structure:

```csv
time,channel_0,channel_1,channel_2,channel_3,channel_4,channel_5,channel_6,channel_7,channel_8,channel_9
0,-0.86083984,-0.86083984,-0.86083984,-0.86083984,-0.86083984,-0.86083984,-0.86083984,-0.86083984,-0.86083984,-0.86083984
1,-0.85693359,-0.85693359,-0.85693359,-0.85693359,-0.85693359,-0.85693359,-0.85693359,-0.85693359,-0.85693359,-0.85693359
...
```

**Requirements:**
- First column must be `time` (values are ignored, only channel data is used)
- Must have exactly N columns named `channel_0`, `channel_1`, ..., `channel_N-1`
- All channel values must be numeric
- By default, 10 channels are expected (`channel_0` through `channel_9`)

## Configuration

### Using Blob Storage URLs

In your `project.json`, specify the full blob URL as the `fileName`:

```json
{
  "projectId": "ecg-af-classification",
  "projectName": "ECG Atrial Fibrillation Detection",
  "samples": [
    {
      "id": "sample-001",
      "fileName": "https://labeldataus001.blob.core.windows.net/data/afdata/sample.0.csv",
      "type": "time-series",
      "metadata": {
        "channelCount": 10,
        "description": "Sample description"
      }
    }
  ]
}
```

### Using Local Files

For local CSV files, place them in `config/mock-data/` and reference them by filename:

```json
{
  "id": "sample-local",
  "fileName": "ecg_sample.csv",
  "type": "time-series",
  "metadata": {
    "channelCount": 10
  }
}
```

### Channel Count

Specify the number of channels using the `channelCount` metadata field:

```json
"metadata": {
  "channelCount": 12,  // Default is 10 if not specified
  "description": "12-lead ECG recording"
}
```

## Data Flow

1. **Request**: `/api/samples/:id/data`
2. **Backend Processing**:
   - Detects if filename is a URL or local file
   - Fetches content from blob storage or reads from filesystem
   - Detects file format (CSV or JSON based on extension or content)
   - If CSV: Parses using `CSVParser.parseCSVToTimeSeries()`
   - If JSON: Parses as JSON and extracts `seriesData` array
3. **Response**: Returns time-series data in standard format:
   ```json
   {
     "seriesData": [
       [-0.86083984, -0.85693359, ...],
       [-0.86083984, -0.85693359, ...],
       ...
     ],
     "type": "time-series"
   }
   ```

## CSV Parser Service

Located at `src/services/csvParser.ts`:

```typescript
import { CSVParser } from './services/csvParser';

// Parse CSV to time-series format
const timeSeries = CSVParser.parseCSVToTimeSeries(csvContent, 10);
// Returns: { seriesData: number[][], type: 'time-series' }

// Or use intermediate parsing
const csvData = CSVParser.parseCSV(csvContent);
// Returns: { headers: string[], rows: Record<string, any>[] }
```

## Features

- ✅ Automatic format detection (CSV vs JSON)
- ✅ Supports both blob URLs and local files
- ✅ Configurable channel count per sample
- ✅ Graceful fallback to generated data if file not found
- ✅ CSV parsing with numeric coercion
- ✅ Full integration with existing time-series UI

## Example: Azure Blob Storage Setup

```bash
# Use the provided example config
export CONFIG_PATH=config/project-blob.json
npm run dev
```

Then update the URLs in `config/project-blob.json` with your actual blob storage account and container names.

## Troubleshooting

- **"Invalid time-series data format"**: Check that CSV has correct headers and all values are numeric
- **"Failed to fetch from blob URL"**: Verify the blob storage URL is accessible and public (or configure CORS)
- **Missing channel data**: Ensure CSV has all expected `channel_N` columns
- **Fewer data points than expected**: CSV rows are parsed directly; ensure input has sufficient rows

## Performance Notes

- CSV parsing happens server-side before sending to client
- For large CSV files (>100k rows), consider preprocessing to reduce size
- Blob storage requests are cached by default HTTP mechanisms
- Local file reading is synchronous; consider async if handling many files

## Future Enhancements

- Support for gzipped CSV files
- Automatic channel count detection from CSV headers
- Batch processing of multiple samples
- Data normalization options
- Resampling/downsampling for large datasets
