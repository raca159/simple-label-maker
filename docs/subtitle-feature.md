# Label Subtitle Feature

## Overview

The label subtitle feature allows you to add descriptive text (subtitles) to label groups in the UI.xml configuration. Subtitles provide additional context or instructions to annotators and can be positioned either above or below the label options.

## Supported Label Types

Subtitles are supported for:
1. **Regular labels** (choices/classification)
2. **Time-series SeriesOptions** (per-channel labels)
3. **Time-series GlobalOptions** (global sample labels)

## XML Configuration

### Regular Labels (Choices/Classification)

Add `subtitle` and `subtitlePosition` attributes to the `<Label>` element:

```xml
<Label name="category" type="choices" required="true" 
       subtitle="Select the primary object visible in the image" 
       subtitlePosition="below">
  <Option value="cat" label="Cat" hotkey="1" color="#FF5733" />
  <Option value="dog" label="Dog" hotkey="2" color="#33FF57" />
</Label>
```

**Attributes:**
- `subtitle` (optional): The subtitle text to display
- `subtitlePosition` (optional): Position of subtitle - `"above"` or `"below"` (default: `"below"`)

### Time-Series SeriesOptions

Add `subtitle` and `subtitlePosition` attributes to the `<SeriesOptions>` element:

```xml
<SeriesOptions subtitle="Select the classification for each individual lead" 
               subtitlePosition="above">
  <Option value="STD" label="STD" color="#FF5733" />
  <Option value="None" label="None" color="#C0C0C0" />
</SeriesOptions>
```

### Time-Series GlobalOptions

Add `subtitle` and `subtitlePosition` attributes to the `<GlobalOptions>` element:

```xml
<GlobalOptions subtitle="Choose the overall sample classification based on all leads" 
               subtitlePosition="below">
  <Option value="STD" label="STD" color="#FF5733" />
  <Option value="nonSTD" label="non STD" color="#489f58ff" />
</GlobalOptions>
```

## Complete Examples

### Example 1: Image Classification with Subtitles

```xml
<?xml version="1.0" encoding="UTF-8"?>
<LabelingInterface title="Image Classification" description="Classify images with helpful subtitles.">
  <DataSource type="image" field="imageUrl" />
  
  <Labels>
    <Label name="category" type="choices" required="true" 
           subtitle="Select the primary object visible in the image" 
           subtitlePosition="below">
      <Option value="cat" label="Cat" hotkey="1" color="#FF5733" />
      <Option value="dog" label="Dog" hotkey="2" color="#33FF57" />
      <Option value="bird" label="Bird" hotkey="3" color="#3357FF" />
    </Label>
    
    <Label name="tags" type="choices" required="false" multiSelect="true"
           subtitle="Choose all tags that apply" 
           subtitlePosition="above">
      <Option value="outdoor" label="Outdoor" color="#10B981" />
      <Option value="indoor" label="Indoor" color="#8B5CF6" />
    </Label>
  </Labels>
  
  <Layout columns="1" showProgress="true" showInstructions="true" />
</LabelingInterface>
```

### Example 2: Time-Series with Subtitles

```xml
<?xml version="1.0" encoding="UTF-8"?>
<LabelingInterface title="ECG Classification" description="Classify ECG leads.">
  <DataSource type="time-series" field="seriesData" />
  
  <Labels>
    <Label name="ecg" type="time-series" count="12" required="true" 
           globalLabel="Overall Diagnosis" commentLabel="Clinical Notes">
      <Axis min="-1.5" max="1.5" />
      
      <SeriesOptions subtitle="Classify each lead individually" 
                     subtitlePosition="above">
        <Option value="normal" label="Normal" color="#10B981" />
        <Option value="AF" label="Atrial Fibrillation" color="#EF4444" />
      </SeriesOptions>
      
      <GlobalOptions subtitle="Based on all leads, select the overall diagnosis" 
                     subtitlePosition="below">
        <Option value="normal" label="Normal Sinus Rhythm" color="#10B981" />
        <Option value="AF" label="Atrial Fibrillation" color="#EF4444" />
      </GlobalOptions>
    </Label>
  </Labels>
  
  <Layout columns="1" showProgress="true" showInstructions="true" />
</LabelingInterface>
```

## Visual Styling

Subtitles are rendered with the following styling:
- Font size: 13px (0.8125rem)
- Color: Slate gray (#64748b)
- Font style: Italic
- Line height: 1.4

**Positioning:**
- `above`: Appears with margin below (0.5rem)
- `below`: Appears with margin above (0.5rem)

**Series subtitles** (time-series only) have additional styling:
- Centered text alignment
- Border separator (top or bottom depending on position)
- Extra padding for visual separation

## Use Cases

Subtitles are useful for:
1. **Clarifying instructions** - Provide specific guidance for each label group
2. **Reducing errors** - Help annotators understand what to select
3. **Context-specific guidance** - Different instructions for different label types
4. **Training new annotators** - Built-in help text that's always visible
5. **Complex workflows** - Distinguish between similar label groups

## Best Practices

1. **Keep subtitles concise** - One clear sentence is usually sufficient
2. **Use `above` for instructions** - When you want annotators to read before selecting
3. **Use `below` for clarifications** - When you want to reinforce after selection
4. **Be consistent** - Use similar positioning across similar label types
5. **Avoid redundancy** - Don't repeat information already in the label title

## Implementation Details

### TypeScript Types

The subtitle configuration is defined in `src/types/index.ts`:

```typescript
export interface LabelConfig {
  // Regular label subtitle
  subtitle?: string;
  subtitlePosition?: 'above' | 'below';
  
  // Time-series specific subtitles
  seriesSubtitle?: string;
  seriesSubtitlePosition?: 'above' | 'below';
  globalSubtitle?: string;
  globalSubtitlePosition?: 'above' | 'below';
  // ... other fields
}
```

### CSS Classes

- `.label-subtitle` - Base subtitle styling
- `.label-subtitle-above` - Subtitle positioned above labels
- `.label-subtitle-below` - Subtitle positioned below labels
- `.series-subtitle` - Additional styling for time-series subtitles

## Migration Guide

Existing UI.xml files will continue to work without any changes. The subtitle feature is entirely optional and backwards compatible.

To add subtitles to an existing configuration:
1. Add the `subtitle` attribute to the desired label element
2. Optionally add `subtitlePosition` (defaults to `"below"`)
3. Test the labeling interface to ensure the subtitle appears as expected

## Screenshot

![Subtitle Feature](https://github.com/user-attachments/assets/8462f175-2bb5-41c4-9337-c3421ed9361a)

The screenshot shows:
- **Global subtitle** below the global options: "Choose the overall sample classification based on all leads"
- **Series subtitle** above the series options: "Select the classification for each individual lead"
