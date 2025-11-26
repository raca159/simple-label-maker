---
layout: default
title: Custom Schemas Guide
---

# Creating Custom Labeling Schemas

This guide walks you through creating custom UI.xml schemas for specialized labeling tasks.

## Getting Started

### Step 1: Choose Your Base Template

Start with a template that's closest to your use case:

```bash
# Copy a template as your starting point
cp config/templates/image-classification.xml config/UI.xml
```

### Step 2: Define Your Data Source

Update the `<DataSource>` element to match your data type:

```xml
<!-- For images -->
<DataSource type="image" field="imageUrl" />

<!-- For text -->
<DataSource type="text" field="content" />

<!-- For audio -->
<DataSource type="audio" field="url" />

<!-- For video -->
<DataSource type="video" field="url" />

<!-- For time-series -->
<DataSource type="time-series" field="seriesData" />
```

### Step 3: Design Your Labels

Define the labels that annotators will use. You can combine multiple label types.

---

## Common Customization Patterns

### Adding Classification Categories

Add or modify `<Option>` elements within a `<Label>`:

```xml
<Label name="defect_type" type="choices" required="true" multiSelect="false">
  <Option value="scratch" label="Scratch" hotkey="1" color="#EF4444" />
  <Option value="dent" label="Dent" hotkey="2" color="#F59E0B" />
  <Option value="crack" label="Crack" hotkey="3" color="#8B5CF6" />
  <Option value="discoloration" label="Discoloration" hotkey="4" color="#3B82F6" />
  <Option value="none" label="No Defect" hotkey="5" color="#10B981" />
</Label>
```

### Combining Multiple Label Types

Create complex annotation interfaces with multiple labels:

```xml
<Labels>
  <!-- Primary classification -->
  <Label name="category" type="choices" required="true">
    <Option value="product_a" label="Product A" hotkey="1" />
    <Option value="product_b" label="Product B" hotkey="2" />
  </Label>
  
  <!-- Secondary classification -->
  <Label name="condition" type="choices" required="true">
    <Option value="new" label="New" hotkey="3" />
    <Option value="used" label="Used" hotkey="4" />
    <Option value="damaged" label="Damaged" hotkey="5" />
  </Label>
  
  <!-- Quality score -->
  <Label name="quality" type="rating" required="false" min="1" max="10" />
  
  <!-- Free-form notes -->
  <Label name="notes" type="text-input" required="false" />
</Labels>
```

### Creating Hierarchical Categories

Use naming conventions to create logical groupings:

```xml
<Labels>
  <!-- Main category -->
  <Label name="main_category" type="choices" required="true">
    <Option value="animal" label="Animal" hotkey="1" />
    <Option value="vehicle" label="Vehicle" hotkey="2" />
    <Option value="object" label="Object" hotkey="3" />
  </Label>
  
  <!-- Sub-category (shown for all, but contextually relevant) -->
  <Label name="sub_category" type="choices" required="false" multiSelect="true">
    <!-- Animals -->
    <Option value="mammal" label="Mammal" color="#10B981" />
    <Option value="bird" label="Bird" color="#3B82F6" />
    <Option value="reptile" label="Reptile" color="#8B5CF6" />
    <!-- Vehicles -->
    <Option value="car" label="Car" color="#EF4444" />
    <Option value="truck" label="Truck" color="#F59E0B" />
    <Option value="motorcycle" label="Motorcycle" color="#EC4899" />
  </Label>
</Labels>
```

---

## Custom Time-Series Schema

For time-series data, configure the visualization and classification options:

```xml
<Label name="sensor_data" type="time-series" count="8" required="true" 
       globalLabel="Overall Assessment" commentLabel="Technical Notes">
  
  <!-- Configure y-axis range for your data -->
  <Axis min="0" max="100" />
  
  <!-- Per-series classification -->
  <SeriesOptions>
    <Option value="normal" label="Normal Operation" color="#10B981" />
    <Option value="high" label="Above Threshold" color="#F59E0B" />
    <Option value="low" label="Below Threshold" color="#3B82F6" />
    <Option value="error" label="Error/Malfunction" color="#EF4444" />
    <Option value="offline" label="Sensor Offline" color="#6B7280" />
  </SeriesOptions>
  
  <!-- Global classification with hotkeys -->
  <GlobalOptions>
    <Option value="operational" label="Fully Operational" hotkey="o" color="#10B981" />
    <Option value="degraded" label="Degraded Performance" hotkey="d" color="#F59E0B" />
    <Option value="failure" label="System Failure" hotkey="f" color="#EF4444" />
    <Option value="maintenance" label="Needs Maintenance" hotkey="m" color="#8B5CF6" />
  </GlobalOptions>
</Label>
```

---

## Example: Medical Image Classification

A complete example for medical imaging:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<LabelingInterface title="Chest X-Ray Classification" 
                   description="Classify chest X-ray findings. Mark all applicable conditions and rate image quality.">
  <DataSource type="image" field="imageUrl" />
  
  <Labels>
    <!-- Primary finding (required) -->
    <Label name="primary_finding" type="choices" required="true" multiSelect="false">
      <Option value="normal" label="Normal" hotkey="1" color="#10B981" />
      <Option value="pneumonia" label="Pneumonia" hotkey="2" color="#EF4444" />
      <Option value="tuberculosis" label="Tuberculosis" hotkey="3" color="#F59E0B" />
      <Option value="cardiomegaly" label="Cardiomegaly" hotkey="4" color="#8B5CF6" />
      <Option value="other" label="Other Pathology" hotkey="5" color="#3B82F6" />
    </Label>
    
    <!-- Secondary findings (optional, multi-select) -->
    <Label name="secondary_findings" type="choices" required="false" multiSelect="true">
      <Option value="pleural_effusion" label="Pleural Effusion" color="#EF4444" />
      <Option value="atelectasis" label="Atelectasis" color="#F59E0B" />
      <Option value="nodule" label="Nodule" color="#8B5CF6" />
      <Option value="mass" label="Mass" color="#EC4899" />
      <Option value="infiltrate" label="Infiltrate" color="#3B82F6" />
    </Label>
    
    <!-- Severity assessment -->
    <Label name="severity" type="choices" required="true">
      <Option value="mild" label="Mild" hotkey="6" color="#10B981" />
      <Option value="moderate" label="Moderate" hotkey="7" color="#F59E0B" />
      <Option value="severe" label="Severe" hotkey="8" color="#EF4444" />
      <Option value="na" label="N/A (Normal)" hotkey="9" color="#6B7280" />
    </Label>
    
    <!-- Image quality -->
    <Label name="image_quality" type="rating" required="true" min="1" max="5" />
    
    <!-- Clinical notes -->
    <Label name="clinical_notes" type="text-input" required="false" />
  </Labels>
  
  <Layout columns="1" showProgress="true" showInstructions="true" />
</LabelingInterface>
```

---

## Example: E-commerce Product Tagging

A multi-label example for product images:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<LabelingInterface title="Product Image Tagging" 
                   description="Tag product images with relevant attributes. Select all that apply.">
  <DataSource type="image" field="imageUrl" />
  
  <Labels>
    <!-- Product category -->
    <Label name="category" type="choices" required="true" multiSelect="false">
      <Option value="clothing" label="Clothing" hotkey="1" color="#3B82F6" />
      <Option value="electronics" label="Electronics" hotkey="2" color="#8B5CF6" />
      <Option value="home" label="Home & Garden" hotkey="3" color="#10B981" />
      <Option value="sports" label="Sports" hotkey="4" color="#F59E0B" />
    </Label>
    
    <!-- Visual attributes (multi-select) -->
    <Label name="attributes" type="choices" required="false" multiSelect="true">
      <Option value="lifestyle" label="Lifestyle Shot" color="#EC4899" />
      <Option value="model" label="Has Model" color="#8B5CF6" />
      <Option value="white_bg" label="White Background" color="#6B7280" />
      <Option value="multiple" label="Multiple Products" color="#3B82F6" />
      <Option value="closeup" label="Close-up" color="#10B981" />
      <Option value="text_overlay" label="Has Text Overlay" color="#F59E0B" />
    </Label>
    
    <!-- Image quality for e-commerce -->
    <Label name="quality" type="rating" required="true" min="1" max="5" />
    
    <!-- Issues (if any) -->
    <Label name="issues" type="text-input" required="false" />
  </Labels>
  
  <Layout columns="1" showProgress="true" showInstructions="true" />
</LabelingInterface>
```

---

## Validation and Testing

### Schema Validation Checklist

Before deploying your schema:

- [ ] All `<Label>` elements have unique `name` attributes
- [ ] All `<Option>` elements have `value` and `label` attributes
- [ ] Hotkeys (1-9) are not duplicated within the same label
- [ ] Required fields are clearly marked
- [ ] Color codes are valid hex values (e.g., `#FF5733`)
- [ ] Data source type matches your sample data

### Testing Your Schema

1. Copy your schema to `config/UI.xml`
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open http://localhost:3000 in your browser
4. Verify:
   - All labels appear correctly
   - Hotkeys work as expected
   - Required field validation works
   - Submission saves correctly

---

## Troubleshooting

### Labels Not Rendering

**Cause:** Invalid XML syntax or missing elements

**Solution:**
- Validate XML syntax (check for unclosed tags)
- Ensure `<LabelingInterface>` root element exists
- Check browser console for parsing errors

### Hotkeys Not Working

**Cause:** Focus on input elements or duplicate hotkeys

**Solution:**
- Click outside of text inputs before using hotkeys
- Verify hotkeys are unique within each label
- Check for JavaScript errors in console

### Time-Series Charts Not Displaying

**Cause:** Missing Chart.js or incorrect data format

**Solution:**
- Verify Chart.js CDN is loading
- Check `seriesData` format is `number[][]`
- Ensure `count` attribute matches your data

---

## Best Practices Summary

1. **Keep it simple** - Only add labels that are necessary
2. **Use clear naming** - Label names should be self-explanatory
3. **Assign hotkeys wisely** - Most common options get easy hotkeys
4. **Color code consistently** - Use a consistent color scheme
5. **Test with real data** - Validate against actual samples
6. **Document your schema** - Add XML comments for future reference
7. **Iterate based on feedback** - Refine based on annotator experience

---

## Next Steps

- Review [Labeling Schemas Guide](labeling-schemas.md) for complete reference
- Browse [Templates](templates.md) for more examples
- Return to [Documentation Home](index.md)
