---
layout: default
title: Templates Guide
---

# Templates Guide

Simple Label Maker includes ready-to-use templates for common labeling tasks. This guide describes each template and how to use them.

## Available Templates

| Template | Data Type | Use Case |
|----------|-----------|----------|
| [Image Classification](#image-classification) | Image | Classify images into categories |
| [Text Sentiment](#text-sentiment-analysis) | Text | Sentiment analysis of text |
| [Audio Classification](#audio-classification) | Audio | Classify audio content |
| [Video Annotation](#video-annotation) | Video | Annotate video content |
| [Time-Series ECG](#time-series-ecg-classification) | Time-Series | ECG/medical signal classification |
| [Time-Series Sensor](#time-series-sensor-data) | Time-Series | IoT/sensor data classification |
| [Multi-Label Classification](#multi-label-classification) | Image | Multiple labels per image |
| [Bounding Box](#bounding-box-annotation) | Image | Object detection (planned) |

## Using a Template

1. Choose a template that matches your use case
2. Copy it to your config directory:
   ```bash
   cp config/templates/image-classification.xml config/UI.xml
   ```
3. Customize the template (change labels, colors, hotkeys)
4. Restart the application

---

## Image Classification

**File:** `config/templates/image-classification.xml`

Use this template for single-label image classification tasks.

### Features
- Single-select classification with 4 categories
- Keyboard shortcuts (1-4) for fast labeling
- Optional quality rating (1-5 stars)
- Optional notes field

### Default Categories
- Cat, Dog, Bird, Other

### Customization Ideas
- Change categories for your domain (e.g., product types, defect classifications)
- Add more categories with unique hotkeys
- Remove rating/notes if not needed

### Sample Configuration

```xml
<Label name="category" type="choices" required="true" multiSelect="false">
  <Option value="cat" label="Cat" hotkey="1" color="#FF5733" />
  <Option value="dog" label="Dog" hotkey="2" color="#33FF57" />
  <Option value="bird" label="Bird" hotkey="3" color="#3357FF" />
  <Option value="other" label="Other" hotkey="4" color="#9B59B6" />
</Label>
```

---

## Text Sentiment Analysis

**File:** `config/templates/text-sentiment.xml`

Use this template for sentiment classification of text documents.

### Features
- 3-class sentiment (Positive, Neutral, Negative)
- Emoji indicators for quick visual reference
- Confidence rating
- Highlights/notes field for key phrases

### Default Categories
- Positive 😊 (green)
- Neutral 😐 (gray)
- Negative 😞 (red)

### Customization Ideas
- Add more granular sentiment levels (Very Positive, Somewhat Positive, etc.)
- Add topic classification as a secondary label
- Add entity extraction notes

---

## Audio Classification

**File:** `config/templates/audio-classification.xml`

Use this template for classifying audio files.

### Features
- 5 audio categories
- Quality rating for audio clarity
- Transcription field for speech content

### Default Categories
- Speech, Music, Ambient/Background, Noise/Static, Silence

### Customization Ideas
- Change to music genres (Rock, Pop, Jazz, etc.)
- Add speaker identification categories
- Add emotion detection labels

---

## Video Annotation

**File:** `config/templates/video-annotation.xml`

Use this template for video content classification.

### Features
- 5 content type categories
- Quality rating
- Description field for timestamps and notes

### Default Categories
- Educational, Entertainment, News/Information, Advertisement, Other

### Customization Ideas
- Add scene type classification
- Add action recognition categories
- Add content moderation flags (safe/unsafe)

---

## Time-Series ECG Classification

**File:** `config/templates/time-series-ecg.xml`

Use this template for multi-lead ECG signal classification.

### Features
- 12-lead ECG visualization
- Per-lead classification
- Global diagnosis classification
- Clinical notes field
- Y-axis configured for ECG amplitude (-1.5 to 1.5)

### Per-Lead Options
- Normal, Atrial Fibrillation, Noise/Artifact, Other Abnormality

### Global Options (with hotkeys)
- Normal Sinus Rhythm (n)
- Atrial Fibrillation (a)
- Other Arrhythmia (o)

### Customization Ideas
- Adjust lead count for different ECG configurations (3-lead, 6-lead)
- Add more arrhythmia classifications
- Adjust axis range for different signal amplitudes

---

## Time-Series Sensor Data

**File:** `config/templates/time-series-sensor.xml`

Use this template for IoT and sensor data classification.

### Features
- 6-channel sensor visualization
- Per-channel anomaly classification
- Overall sample status
- Observations field
- Y-axis configured for typical sensor values (-10 to 10)

### Per-Channel Options
- Normal, Anomaly Detected, Sensor Drift, Missing Data

### Global Options (with hotkeys)
- Healthy (h)
- Warning (w)
- Critical (c)

### Customization Ideas
- Adjust channel count for your sensor setup
- Add specific anomaly types for your domain
- Configure axis range for your sensor values

---

## Multi-Label Classification

**File:** `config/templates/multi-label-classification.xml`

Use this template when images can have multiple labels simultaneously.

### Features
- Multi-select enabled (8 tags)
- All hotkeys (1-8) for quick selection
- Quality rating
- Description field

### Default Tags
- Outdoor, Indoor, People, Animals, Vehicles, Nature, Urban, Contains Text

### Customization Ideas
- Create domain-specific tag sets
- Add hierarchical tag groups
- Combine with other label types

---

## Bounding Box Annotation

**File:** `config/templates/bounding-box.xml`

**Note:** Bounding box functionality is planned but not yet implemented. This template serves as a reference for the expected schema format.

### Features
- Object class definitions for bounding boxes
- Scene type classification (fallback for current use)
- Notes field

### Object Classes
- Car, Person, Bicycle, Motorcycle, Bus, Truck

### Scene Types (current functionality)
- Street Scene, Parking Lot, Highway, Intersection

---

## Creating Your Own Template

To create a custom template:

1. Start with the closest existing template
2. Copy and rename it:
   ```bash
   cp config/templates/image-classification.xml config/templates/my-custom.xml
   ```
3. Edit the XML to match your requirements
4. Test by copying to `config/UI.xml` and running the application

See [Custom Schemas Guide](custom-schemas.md) for detailed instructions.

---

## Template Best Practices

1. **Start simple** - Begin with a basic template and add complexity as needed
2. **Test early** - Verify your schema works before adding many samples
3. **Document customizations** - Keep notes in XML comments for future reference
4. **Use consistent colors** - Create a color scheme for your project
5. **Optimize hotkeys** - Assign hotkeys to frequently used options
6. **Backup before changes** - Keep copies of working configurations

## Next Steps

- Learn about [Labeling Schemas](labeling-schemas.md) in detail
- Create [Custom Schemas](custom-schemas.md) for specialized needs
- Return to [Documentation Home](index.md)
