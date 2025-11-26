---
layout: default
title: Simple Label Maker Documentation
---

# Simple Label Maker Documentation

Welcome to the Simple Label Maker documentation. This guide will help you understand how to configure and use the labeling interface for your data annotation projects.

## Quick Links

- [Getting Started](#getting-started)
- [Labeling Schemas Guide](labeling-schemas.md) - Learn about UI.xml schema structure
- [Templates Guide](templates.md) - Ready-to-use templates for common labeling tasks
- [Custom Schemas Guide](custom-schemas.md) - Create your own labeling schemas

## Getting Started

Simple Label Maker is a containerized data labeling solution that supports multiple data types and labeling strategies. It's designed to run on Azure with Azure B2C authentication and Azure Blob Storage integration.

### Supported Data Types

| Type | Description | Use Case |
|------|-------------|----------|
| `image` | Image files (jpg, png, etc.) | Image classification, object detection |
| `text` | Text documents | Sentiment analysis, text classification |
| `audio` | Audio files | Audio classification, transcription |
| `video` | Video files | Video annotation, action recognition |
| `time-series` | Multi-timeseries data (JSON arrays) | ECG classification, sensor data analysis |

### Supported Label Types

| Type | Description | Attributes |
|------|-------------|------------|
| `choices` / `classification` | Single or multi-select options | `multiSelect`, `required` |
| `rating` | Star rating | `min`, `max` |
| `text-input` | Free-form text | `required` |
| `time-series` | Multi-series annotation | `count`, `globalLabel`, `commentLabel` |
| `bounding-box` | Draw bounding boxes (planned) | - |
| `polygon` | Draw polygons (planned) | - |

## Project Structure

```
simple-label-maker/
├── config/
│   ├── project.json       # Project configuration
│   ├── UI.xml             # Active labeling schema
│   └── templates/         # Ready-to-use schema templates
│       ├── image-classification.xml
│       ├── text-sentiment.xml
│       ├── audio-classification.xml
│       ├── video-annotation.xml
│       ├── time-series-ecg.xml
│       ├── time-series-sensor.xml
│       ├── multi-label-classification.xml
│       └── bounding-box.xml
├── docs/                  # Documentation
├── public/                # Frontend assets
└── src/                   # Backend source code
```

## Using Templates

To use a template, copy it to `config/UI.xml`:

```bash
# Example: Use the image classification template
cp config/templates/image-classification.xml config/UI.xml
```

Then customize the template according to your needs. See the [Templates Guide](templates.md) for detailed information about each template.

## Configuration Files

### project.json

Defines your project metadata, Azure storage settings, and sample definitions:

```json
{
  "projectId": "my-project",
  "projectName": "My Labeling Project",
  "description": "Instructions for annotators",
  "azureStorage": {
    "accountName": "your-storage-account",
    "containerName": "labeling-data",
    "dataPath": "samples",
    "annotationsPath": "annotations"
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

### UI.xml

Defines the labeling interface. See [Labeling Schemas Guide](labeling-schemas.md) for complete documentation.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `1-9` | Select option with matching hotkey |
| `Ctrl + Enter` | Submit annotation |
| `Alt + Left` | Previous sample |
| `Alt + Right` | Next sample |

## Next Steps

1. Review the [Labeling Schemas Guide](labeling-schemas.md) to understand the UI.xml format
2. Browse [Templates](templates.md) to find a starting point for your project
3. Learn how to [Create Custom Schemas](custom-schemas.md) for specialized use cases
