# Scripts Directory

This directory contains utility scripts for Simple Label Maker.

## migrate_from_label_studio.py

Convert Label Studio task files to Simple Label Maker sample format.

### Usage

```bash
python3 scripts/migrate_from_label_studio.py \
  --task <path-to-label-studio-task.json> \
  --type <sample-type> \
  --metadata '<json-metadata>' \
  --output <output-file> \
  --data-field <field-name>
```

### Arguments

| Argument | Required | Description | Example |
|----------|----------|-------------|---------|
| `--task` | Yes | Path to Label Studio task JSON file | `tasks.json` |
| `--type` | Yes | Sample type for all samples | `time-series`, `image`, `text`, `audio`, `video` |
| `--metadata` | No | JSON metadata to apply to all samples | `'{"channelCount": 10}'` |
| `--output` | No | Output file path (default: `samples.json`) | `config/samples.json` |
| `--data-field` | No | Specific data field to extract | `csv_url`, `image_url` |

### Label Studio Task Format

Label Studio tasks can be in various formats. The script supports:

**Nested array format:**
```json
[
  [
    {
      "id": "task_0",
      "data": {
        "csv_url": "https://storage.blob.core.windows.net/data/sample.1.csv"
      }
    }
  ],
  [
    {
      "id": "task_1",
      "data": {
        "csv_url": "https://storage.blob.core.windows.net/data/sample.2.csv"
      }
    }
  ]
]
```

**Flat array format:**
```json
[
  {
    "id": "task_0",
    "data": {
      "image_url": "https://storage.blob.core.windows.net/images/img1.jpg"
    }
  },
  {
    "id": "task_1",
    "data": {
      "image_url": "https://storage.blob.core.windows.net/images/img2.jpg"
    }
  }
]
```

### Output Format

The script generates a JSON array compatible with Simple Label Maker:

```json
[
  {
    "id": "task_0",
    "fileName": "https://storage.blob.core.windows.net/data/sample.1.csv",
    "type": "time-series",
    "metadata": {
      "channelCount": 10
    }
  },
  {
    "id": "task_1",
    "fileName": "https://storage.blob.core.windows.net/data/sample.2.csv",
    "type": "time-series",
    "metadata": {
      "channelCount": 10
    }
  }
]
```

### Examples

**Convert time-series data:**
```bash
python3 scripts/migrate_from_label_studio.py \
  --task label_studio_ecg_tasks.json \
  --type time-series \
  --metadata '{"channelCount": 12, "source": "ecg-dataset"}' \
  --output config/ecg-samples.json \
  --data-field csv_url
```

**Convert image data:**
```bash
python3 scripts/migrate_from_label_studio.py \
  --task label_studio_images.json \
  --type image \
  --output config/image-samples.json \
  --data-field image_url
```

**Convert text data with auto-detected field:**
```bash
python3 scripts/migrate_from_label_studio.py \
  --task label_studio_text.json \
  --type text \
  --output config/text-samples.json
```

### Using the Output

After migration, update your `project.json` to reference the generated file:

```json
{
  "projectId": "my-project",
  "projectName": "My Labeling Project",
  "description": "Migrated from Label Studio",
  "azureStorage": { ... },
  "authentication": { ... },
  "sampleTask": {
    "fileName": "ecg-samples.json"
  },
  "samples": []
}
```

The `fileName` can be:
- Relative to the `config/` directory: `"samples.json"`
- Absolute path: `"/path/to/samples.json"`

### Error Handling

The script will:
- Skip tasks with missing or invalid data fields
- Print warnings for skipped tasks to stderr
- Exit with error code 1 if no valid samples were converted
- Provide helpful error messages for JSON parsing errors

### Dependencies

- Python 3.6+
- Standard library only (no external dependencies required)
