# Scripts Directory

This directory contains utility scripts for Simple Label Maker.

## generate_hybrid_overlap_tasks.py

Generate task files with a hybrid assignment model:

- A percentage of samples are overlap samples.
- Overlap samples are assigned to N tasks (for reconciliation).
- Remaining samples are assigned to exactly 1 task.

This is useful when you want reconciliation coverage without making all samples multi-review.

### Usage

```bash
python3 scripts/generate_hybrid_overlap_tasks.py \
  --sample-count <total-samples> \
  --task-count <num-task-files> \
  --overlap-percent <percent-overlap-samples> \
  --reviewers-per-overlap <n> \
  --base-url <blob-base-url> \
  --output-dir <output-directory>
```

### Arguments

| Argument | Required | Description | Example |
|----------|----------|-------------|---------|
| `--sample-count` | Yes | Total number of samples | `2000` |
| `--task-count` | Yes | Number of task files to generate | `5` |
| `--overlap-percent` | Yes | Percentage of samples that should be overlap samples | `20` |
| `--reviewers-per-overlap` | No | Number of tasks each overlap sample appears in (default: `3`) | `3` |
| `--base-url` | Yes | Blob URL prefix used for all samples | `https://labeldataus001.blob.core.windows.net/data/afdata/` |
| `--output-dir` | No | Output directory for generated `task_*.json` files | `./tasks-hybrid` |
| `--sample-prefix` | No | Sample filename prefix | `sample.` |
| `--sample-extension` | No | Sample filename extension | `.csv` |
| `--start-index` | No | First sample index | `0` |
| `--data-field` | No | Data field name in task `data` object | `csv_url` |
| `--task-prefix` | No | Output task filename prefix | `task_` |
| `--id-prefix` | No | Prefix for generated item IDs | `task` |

### Example: 2000 CSV Samples, 20% Overlap Samples, 3 Reviewers for Overlap

```bash
python3 scripts/generate_hybrid_overlap_tasks.py \
  --sample-count 2000 \
  --task-count 5 \
  --overlap-percent 20 \
  --reviewers-per-overlap 3 \
  --base-url https://labeldataus001.blob.core.windows.net/data/afdata/ \
  --sample-prefix sample. \
  --sample-extension .csv \
  --data-field csv_url \
  --output-dir ./tasks-hybrid
```

### Assignment Guarantees

- Overlap samples appear exactly `reviewers-per-overlap` times.
- Non-overlap samples appear exactly once.
- Coverage is validated before writing files.

## generate_multi_reviewer_tasks.py

Generate task files so each sample is assigned to an exact number of reviewers.

This is ideal for reconciliation workflows such as 3-person overlap voting.

### Usage

```bash
python3 scripts/generate_multi_reviewer_tasks.py \
  --sample-count <total-samples> \
  --task-count <num-task-files> \
  --reviewers-per-sample <k> \
  --base-url <blob-base-url> \
  --output-dir <output-directory>
```

### Arguments

| Argument | Required | Description | Example |
|----------|----------|-------------|---------|
| `--sample-count` | Yes | Total number of samples | `2000` |
| `--task-count` | Yes | Number of task files to generate | `5` |
| `--reviewers-per-sample` | No | Exact number of task files each sample must appear in (default: `3`) | `3` |
| `--base-url` | Yes | Blob URL prefix used for all samples | `https://labeldataus001.blob.core.windows.net/data/afdata/` |
| `--output-dir` | No | Output directory for generated `task_*.json` files | `./tasks-three-reviewers` |
| `--sample-prefix` | No | Sample filename prefix | `sample.` |
| `--sample-extension` | No | Sample filename extension | `.csv` |
| `--start-index` | No | First sample index | `0` |
| `--data-field` | No | Data field name in task `data` object | `csv_url` |
| `--task-prefix` | No | Output task filename prefix | `task_` |
| `--id-prefix` | No | Prefix for generated item IDs | `task` |

### Example: 2000 CSV Samples, 5 Task Files, 3 Reviewers Per Sample

```bash
python3 scripts/generate_multi_reviewer_tasks.py \
  --sample-count 2000 \
  --task-count 5 \
  --reviewers-per-sample 3 \
  --base-url https://labeldataus001.blob.core.windows.net/data/afdata/ \
  --sample-prefix sample. \
  --sample-extension .csv \
  --data-field csv_url \
  --output-dir ./tasks-three-reviewers
```

### Assignment Guarantees

- Every sample appears in exactly `reviewers-per-sample` task files.
- Coverage is validated before files are written.
- Tasks are built using circular chunks for balanced assignment.

## generate_label_studio_tasks.py

Generate multiple Label Studio task JSON split files with circular overlap.

### Usage

```bash
python3 scripts/generate_label_studio_tasks.py \
  --sample-count <total-samples> \
  --task-count <num-task-files> \
  --overlap-percent <overlap-percent> \
  --base-url <blob-base-url> \
  --output-dir <output-directory>
```

### Arguments

| Argument | Required | Description | Example |
|----------|----------|-------------|---------|
| `--sample-count` | Yes | Total number of samples | `2000` |
| `--task-count` | Yes | Number of task files to generate | `20` |
| `--overlap-percent` | No | Total overlap between neighboring tasks. `5` means ~2.5% on each side of the core split | `5` |
| `--base-url` | Yes | Blob URL prefix used for all samples | `https://labeldataus001.blob.core.windows.net/data/afdata/` |
| `--output-dir` | No | Output directory for generated `task_*.json` files | `./tasks` |
| `--sample-prefix` | No | Sample filename prefix | `sample.` |
| `--sample-extension` | No | Sample filename extension | `.csv` |
| `--start-index` | No | First sample index | `0` |
| `--data-field` | No | Data field name in task `data` object | `csv_url` |
| `--task-prefix` | No | Output task filename prefix | `task_` |
| `--id-prefix` | No | Prefix for generated item IDs | `task` |

### Output Format

Each generated file (`task_0.json`, `task_1.json`, etc.) uses nested Label Studio task format:

```json
[
  [
    {
      "id": "task_0_0",
      "data": {
        "csv_url": "https://labeldataus001.blob.core.windows.net/data/afdata/sample.1999.csv"
      }
    }
  ],
  [
    {
      "id": "task_0_1",
      "data": {
        "csv_url": "https://labeldataus001.blob.core.windows.net/data/afdata/sample.0.csv"
      }
    }
  ]
]
```

### Example: 2000 CSV Samples

```bash
python3 scripts/generate_label_studio_tasks.py \
  --sample-count 2000 \
  --task-count 20 \
  --overlap-percent 5 \
  --base-url https://labeldataus001.blob.core.windows.net/data/afdata/ \
  --sample-prefix sample. \
  --sample-extension .csv \
  --data-field csv_url \
  --output-dir ./tasks
```

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
