---
layout: default
title: Labeling Schemas Guide
---

# Labeling Schemas Guide

This guide explains how to configure labeling interfaces using the `UI.xml` schema format.

## UI.xml Structure

The UI.xml file defines your labeling interface using a hierarchical XML structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<LabelingInterface title="Task Title" description="Instructions">
  <Style>
    /* Optional: Custom CSS styles */
  </Style>
  
  <DataSource type="image" field="imageUrl" />
  
  <Labels>
    <!-- Label definitions -->
  </Labels>
  
  <Layout columns="1" showProgress="true" showInstructions="true" />
</LabelingInterface>
```

## Root Element: LabelingInterface

The `<LabelingInterface>` element is the root of every UI.xml file.

### Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `title` | Yes | Title displayed in the labeling interface |
| `description` | No | Instructions shown to annotators |

### Example

```xml
<LabelingInterface 
  title="Image Classification" 
  description="Classify images into categories. Use keyboard shortcuts for faster labeling.">
  <!-- ... -->
</LabelingInterface>
```

## DataSource Element

The `<DataSource>` element defines what type of data you're labeling.

### Attributes

| Attribute | Required | Values | Description |
|-----------|----------|--------|-------------|
| `type` | Yes | `image`, `text`, `audio`, `video`, `time-series` | Type of data |
| `field` | Yes | String | Field name in sample data (e.g., `imageUrl`, `content`, `seriesData`) |

### Examples

```xml
<!-- Image data -->
<DataSource type="image" field="imageUrl" />

<!-- Text data -->
<DataSource type="text" field="content" />

<!-- Audio data -->
<DataSource type="audio" field="url" />

<!-- Video data -->
<DataSource type="video" field="url" />

<!-- Time-series data -->
<DataSource type="time-series" field="seriesData" />
```

## Labels Element

The `<Labels>` element contains one or more `<Label>` elements that define the annotation interface.

### Label Types

1. [Choices / Classification](#choices-classification)
2. [Rating](#rating)
3. [Text Input](#text-input)
4. [Time-Series](#time-series)

---

### Choices / Classification

Use `type="choices"` or `type="classification"` for categorical labels.

#### Attributes

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `name` | Yes | - | Unique identifier for the label |
| `type` | Yes | - | `choices` or `classification` |
| `required` | No | `false` | Whether annotation is required |
| `multiSelect` | No | `false` | Allow multiple selections |

#### Option Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `value` | Yes | Value stored in annotation |
| `label` | Yes | Display text |
| `hotkey` | No | Keyboard shortcut (1-9 or letters) |
| `color` | No | Hex color for visual indicator |

#### Single-Select Example

```xml
<Label name="category" type="choices" required="true" multiSelect="false">
  <Option value="cat" label="Cat" hotkey="1" color="#FF5733" />
  <Option value="dog" label="Dog" hotkey="2" color="#33FF57" />
  <Option value="bird" label="Bird" hotkey="3" color="#3357FF" />
  <Option value="other" label="Other" hotkey="4" color="#9B59B6" />
</Label>
```

#### Multi-Select Example

```xml
<Label name="tags" type="choices" required="true" multiSelect="true">
  <Option value="outdoor" label="Outdoor" hotkey="1" color="#3B82F6" />
  <Option value="indoor" label="Indoor" hotkey="2" color="#8B5CF6" />
  <Option value="people" label="People" hotkey="3" color="#10B981" />
  <Option value="animals" label="Animals" hotkey="4" color="#F59E0B" />
</Label>
```

#### Annotation Output

Single-select:
```json
{ "category": "cat" }
```

Multi-select:
```json
{ "tags": ["outdoor", "people", "animals"] }
```

---

### Rating

Use `type="rating"` for star ratings.

#### Attributes

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `name` | Yes | - | Unique identifier |
| `type` | Yes | - | `rating` |
| `required` | No | `false` | Whether rating is required |
| `min` | No | `1` | Minimum rating value |
| `max` | No | `5` | Maximum rating value |

#### Example

```xml
<Label name="quality" type="rating" required="false" min="1" max="5" />
```

#### Annotation Output

```json
{ "quality": 4 }
```

---

### Text Input

Use `type="text-input"` for free-form text.

#### Attributes

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `name` | Yes | - | Unique identifier |
| `type` | Yes | - | `text-input` |
| `required` | No | `false` | Whether text is required |

#### Example

```xml
<Label name="notes" type="text-input" required="false" />
```

#### Annotation Output

```json
{ "notes": "Clear image with good lighting" }
```

---

### Time-Series

Use `type="time-series"` for multi-channel time series annotation.

#### Attributes

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `name` | Yes | - | Unique identifier |
| `type` | Yes | - | `time-series` |
| `count` | No | `10` | Number of series to display |
| `required` | No | `false` | Whether global label is required |
| `globalLabel` | No | `"Sample Classification"` | Title for global classification |
| `commentLabel` | No | `"Comments/Observations"` | Title for comment field |

#### Child Elements

**Axis** - Configure y-axis range:
```xml
<Axis min="-1" max="1" />
```

**SeriesOptions** - Per-series classification options:
```xml
<SeriesOptions>
  <Option value="normal" label="Normal" color="#10B981" />
  <Option value="anomaly" label="Anomaly" color="#EF4444" />
</SeriesOptions>
```

**SeriesTitles** - Optional per-series plot titles (displayed above each plot):
```xml
<SeriesTitles>
  <Title>Lead I</Title>
  <Title>Lead II</Title>
  <Title>Lead III</Title>
</SeriesTitles>
```

**GlobalOptions** - Overall sample classification:
```xml
<GlobalOptions>
  <Option value="healthy" label="Healthy" hotkey="h" color="#10B981" />
  <Option value="critical" label="Critical" hotkey="c" color="#EF4444" />
</GlobalOptions>
```

#### Complete Example

```xml
<Label name="ecg" type="time-series" count="12" required="true" 
       globalLabel="Diagnosis" commentLabel="Clinical Notes">
  <Axis min="-1.5" max="1.5" />
  <SeriesTitles>
    <Title>Lead I</Title>
    <Title>Lead II</Title>
    <Title>Lead III</Title>
    <Title>aVR</Title>
    <Title>aVL</Title>
    <Title>aVF</Title>
    <Title>V1</Title>
    <Title>V2</Title>
    <Title>V3</Title>
    <Title>V4</Title>
    <Title>V5</Title>
    <Title>V6</Title>
  </SeriesTitles>
  <SeriesOptions>
    <Option value="normal" label="Normal" color="#10B981" />
    <Option value="AF" label="Atrial Fibrillation" color="#EF4444" />
    <Option value="noise" label="Noise/Artifact" color="#F59E0B" />
  </SeriesOptions>
  <GlobalOptions>
    <Option value="normal" label="Normal Sinus Rhythm" hotkey="n" color="#10B981" />
    <Option value="AF" label="Atrial Fibrillation" hotkey="a" color="#EF4444" />
  </GlobalOptions>
</Label>
```

#### Annotation Output

```json
{
  "ecg": {
    "seriesLabels": {
      "series_0": "normal",
      "series_1": "AF",
      "series_2": "noise"
    },
    "globalLabel": "AF",
    "comment": "Clear AF pattern visible in lead II"
  }
}
```

---

## Style Element

The `<Style>` element allows you to add custom CSS to customize the appearance of the labeling interface.

### Overview

Use the `<Style>` element to inject CSS rules that will be applied to the labeling interface. This is useful for:

- Customizing colors, fonts, and spacing
- Adjusting the layout of specific components
- Creating branded labeling experiences
- Fine-tuning the visual appearance for specific use cases

### Basic Usage

Add the `<Style>` element inside your `<LabelingInterface>`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<LabelingInterface title="My Task" description="Instructions...">
  <Style>
    .global-classification-section {
      background-color: #f0f9ff;
      border: 1px solid #0ea5e9;
      border-radius: 8px;
    }
  </Style>
  
  <DataSource type="image" field="imageUrl" />
  <Labels>
    <!-- ... -->
  </Labels>
</LabelingInterface>
```

### Example: Custom Time-Series Styling

```xml
<Style>
  /* Custom styling for the labeling interface */
  .global-classification-section {
    background-color: #f0f9ff;
    border: 1px solid #0ea5e9;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 16px;
  }

  .global-title {
    color: #0369a1;
    font-weight: 600;
  }

  .comment-section {
    background-color: #fefce8;
    border: 1px solid #eab308;
    border-radius: 8px;
    padding: 12px;
  }
  
  .series-option-btn {
    border-radius: 4px;
    font-size: 12px;
  }
</Style>
```

### Available CSS Classes

Common CSS classes you can target:

| Class | Description |
|-------|-------------|
| `.label-group` | Container for each label section |
| `.choices-container` | Container for choice options |
| `.choice-option` | Individual choice button |
| `.rating-container` | Star rating container |
| `.time-series-container` | Time-series labeling container |
| `.global-classification-section` | Global classification area |
| `.global-options` | Global option buttons container |
| `.series-row-with-chart` | Individual series row |
| `.comment-section` | Comment/notes section |
| `.comment-textarea` | Comment text area |

### Limitations

- Custom styles are applied after the default styles, so they can override defaults
- Avoid using `@import` or external URLs for security reasons
- JavaScript cannot be included in the Style block (CSS only)

### Security Considerations

The `<Style>` element is intended for use by project administrators who have access to the `UI.xml` configuration file. The CSS content is injected directly into the page, so ensure that only trusted users can modify the `UI.xml` file.

---

## Layout Element

The `<Layout>` element controls the display of the labeling interface.

### Attributes

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `columns` | No | `1` | Number of columns for layout |
| `showProgress` | No | `true` | Show progress bar |
| `showInstructions` | No | `true` | Show instruction panel |

### Example

```xml
<Layout columns="1" showProgress="true" showInstructions="true" />
```

---

## SampleControl Element

The `<SampleControl>` element allows you to control navigation behavior and sample filtering in the labeling interface.

### Attributes

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `disableSkip` | No | `false` | Hides the Skip button |
| `disablePrevious` | No | `false` | Hides the Previous button |
| `disableNext` | No | `false` | Hides the Next button |
| `filterAnnotatedSamples` | No | `false` | Only show unannotated samples |
| `requireSubmitToNavigate` | No | `false` | Disable Skip/Next buttons until annotation is submitted |

### Examples

#### Require Submission Before Navigation

Force users to submit an annotation before moving to the next sample. This prevents users from skipping samples without labeling them:

```xml
<SampleControl requireSubmitToNavigate="true" />
```

#### Disable Navigation Buttons

Hide specific navigation buttons to control the labeling workflow:

```xml
<SampleControl disableSkip="true" disablePrevious="true" />
```

#### Filter Annotated Samples

Show only samples that haven't been annotated yet:

```xml
<SampleControl filterAnnotatedSamples="true" />
```

#### Combined Configuration

Combine multiple settings for strict workflows:

```xml
<SampleControl 
  requireSubmitToNavigate="true" 
  disableSkip="true" 
  disablePrevious="true"
  filterAnnotatedSamples="true" />
```

### Usage Notes

- **`requireSubmitToNavigate`**: When enabled, the Skip and Next buttons are disabled until the user clicks Submit. This is useful for ensuring all samples in the queue are labeled before moving forward.
- **`filterAnnotatedSamples`**: In demo mode (without Azure Storage), filtering is done client-side using localStorage. In production with Azure, filtering is done server-side.
- Navigation controls can be configured in either `UI.xml` or `project.json`. Settings in `UI.xml` take precedence.

---

## Complete Schema Examples

### Image Classification

```xml
<?xml version="1.0" encoding="UTF-8"?>
<LabelingInterface title="Image Classification" 
                   description="Classify images into categories.">
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

### Text Sentiment

```xml
<?xml version="1.0" encoding="UTF-8"?>
<LabelingInterface title="Sentiment Analysis" 
                   description="Classify text sentiment.">
  <DataSource type="text" field="content" />
  
  <Labels>
    <Label name="sentiment" type="choices" required="true">
      <Option value="positive" label="Positive" hotkey="1" color="#10B981" />
      <Option value="neutral" label="Neutral" hotkey="2" color="#6B7280" />
      <Option value="negative" label="Negative" hotkey="3" color="#EF4444" />
    </Label>
  </Labels>
  
  <Layout columns="1" showProgress="true" showInstructions="true" />
</LabelingInterface>
```

---

## Best Practices

1. **Use descriptive names** - Label names should be clear and meaningful
2. **Add hotkeys** - Speed up annotation with keyboard shortcuts
3. **Use colors** - Visual indicators help distinguish options
4. **Mark required fields** - Set `required="true"` for essential labels
5. **Provide clear instructions** - Use the description attribute effectively
6. **Test your schema** - Verify the interface works as expected before deploying

## Next Steps

- Browse [Templates](templates.md) for ready-to-use schemas
- Learn to [Create Custom Schemas](custom-schemas.md)
- Return to [Documentation Home](index.md)
