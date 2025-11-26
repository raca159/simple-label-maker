import { parseString } from 'xml2js';
import { promisify } from 'util';
import { UISchema, LabelConfig, DataSource, LayoutConfig, LabelOption, AxisConfig } from '../types';

const parseXml = promisify(parseString);

interface ParsedXML {
  LabelingInterface?: {
    $?: {
      title?: string;
      description?: string;
    };
    DataSource?: Array<{
      $?: {
        type?: string;
        field?: string;
      };
    }>;
    Labels?: Array<{
      Label?: Array<ParsedLabel>;
    }>;
    Layout?: Array<{
      $?: {
        columns?: string;
        showProgress?: string;
        showInstructions?: string;
      };
    }>;
  };
}

interface ParsedLabel {
  $?: {
    name?: string;
    type?: string;
    required?: string;
    multiSelect?: string;
    min?: string;
    max?: string;
    count?: string;
    globalLabel?: string;
    commentLabel?: string;
  };
  Option?: Array<{
    $?: {
      value?: string;
      label?: string;
      hotkey?: string;
      color?: string;
    };
  }>;
  SeriesOptions?: Array<{
    Option?: Array<{
      $?: {
        value?: string;
        label?: string;
        hotkey?: string;
        color?: string;
      };
    }>;
  }>;
  GlobalOptions?: Array<{
    Option?: Array<{
      $?: {
        value?: string;
        label?: string;
        hotkey?: string;
        color?: string;
      };
    }>;
  }>;
  Axis?: Array<{
    $?: {
      min?: string;
      max?: string;
    };
  }>;
}

export class UISchemaParser {
  /**
   * Parse UI.xml content into a UISchema object
   */
  async parse(xmlContent: string): Promise<UISchema> {
    const result = await parseXml(xmlContent) as ParsedXML;
    
    if (!result.LabelingInterface) {
      throw new Error('Invalid UI.xml: Missing LabelingInterface root element');
    }

    const li = result.LabelingInterface;
    
    return {
      labelingInterface: {
        title: li.$?.title ?? 'Labeling Task',
        description: li.$?.description,
        dataSource: this.parseDataSource(li.DataSource),
        labels: this.parseLabels(li.Labels),
        layout: this.parseLayout(li.Layout)
      }
    };
  }

  private parseDataSource(dataSources?: Array<{ $?: { type?: string; field?: string } }>): DataSource {
    const ds = dataSources?.[0]?.$;
    const validTypes: DataSource['type'][] = ['image', 'text', 'audio', 'video', 'time-series'];
    const rawType = ds?.type ?? 'image';
    const type = validTypes.includes(rawType as DataSource['type']) 
      ? rawType as DataSource['type'] 
      : 'image';
    return {
      type,
      field: ds?.field ?? 'data'
    };
  }

  private parseLabels(labelsArray?: Array<{ Label?: ParsedLabel[] }>): LabelConfig[] {
    const labels = labelsArray?.[0]?.Label ?? [];
    const validLabelTypes: LabelConfig['type'][] = ['classification', 'bounding-box', 'polygon', 'text-input', 'choices', 'rating', 'time-series'];
    
    return labels.map((label): LabelConfig => {
      const attrs = label.$ ?? {};
      const rawType = attrs.type ?? 'choices';
      const type = validLabelTypes.includes(rawType as LabelConfig['type'])
        ? rawType as LabelConfig['type']
        : 'choices';
      
      const config: LabelConfig = {
        name: attrs.name ?? 'label',
        type,
        required: attrs.required === 'true',
        multiSelect: attrs.multiSelect === 'true',
        min: attrs.min ? parseInt(attrs.min, 10) : undefined,
        max: attrs.max ? parseInt(attrs.max, 10) : undefined,
        options: this.parseOptions(label.Option)
      };

      // Time-series specific parsing
      if (type === 'time-series') {
        config.count = attrs.count ? parseInt(attrs.count, 10) : 10;
        config.globalLabel = attrs.globalLabel;
        config.commentLabel = attrs.commentLabel;
        config.axis = this.parseAxis(label.Axis);
        config.seriesOptions = this.parseSeriesOptions(label.SeriesOptions);
        config.globalOptions = this.parseGlobalOptions(label.GlobalOptions);
      }

      return config;
    });
  }

  private parseOptions(options?: Array<{ $?: { value?: string; label?: string; hotkey?: string; color?: string } }>): LabelOption[] | undefined {
    if (!options || options.length === 0) {
      return undefined;
    }

    return options.map((opt): LabelOption => ({
      value: opt.$?.value ?? '',
      label: opt.$?.label ?? opt.$?.value ?? '',
      hotkey: opt.$?.hotkey,
      color: opt.$?.color
    }));
  }

  private parseAxis(axisArray?: Array<{ $?: { min?: string; max?: string } }>): AxisConfig | undefined {
    const axis = axisArray?.[0]?.$;
    if (!axis) return undefined;

    return {
      min: axis.min ? parseFloat(axis.min) : undefined,
      max: axis.max ? parseFloat(axis.max) : undefined
    };
  }

  private parseSeriesOptions(seriesOptionsArray?: Array<{ Option?: Array<{ $?: { value?: string; label?: string; hotkey?: string; color?: string } }> }>): LabelOption[] | undefined {
    const seriesOptions = seriesOptionsArray?.[0]?.Option;
    return this.parseOptions(seriesOptions);
  }

  private parseGlobalOptions(globalOptionsArray?: Array<{ Option?: Array<{ $?: { value?: string; label?: string; hotkey?: string; color?: string } }> }>): LabelOption[] | undefined {
    const globalOptions = globalOptionsArray?.[0]?.Option;
    return this.parseOptions(globalOptions);
  }

  private parseLayout(layouts?: Array<{ $?: { columns?: string; showProgress?: string; showInstructions?: string } }>): LayoutConfig | undefined {
    const layout = layouts?.[0]?.$;
    if (!layout) return undefined;

    return {
      columns: layout.columns ? parseInt(layout.columns, 10) : undefined,
      showProgress: layout.showProgress === 'true',
      showInstructions: layout.showInstructions === 'true'
    };
  }

  /**
   * Generate a default UI.xml template
   */
  generateDefaultXml(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<LabelingInterface title="Image Classification" description="Classify the images into categories">
  <DataSource type="image" field="imageUrl" />
  
  <Labels>
    <Label name="category" type="choices" required="true" multiSelect="false">
      <Option value="cat" label="Cat" hotkey="1" color="#FF5733" />
      <Option value="dog" label="Dog" hotkey="2" color="#33FF57" />
      <Option value="bird" label="Bird" hotkey="3" color="#3357FF" />
      <Option value="other" label="Other" hotkey="4" color="#F0F0F0" />
    </Label>
    
    <Label name="quality" type="rating" required="false" min="1" max="5" />
    
    <Label name="notes" type="text-input" required="false" />
  </Labels>
  
  <Layout columns="1" showProgress="true" showInstructions="true" />
</LabelingInterface>`;
  }

  /**
   * Generate a time-series UI.xml template
   */
  generateTimeSeriesXml(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<LabelingInterface title="Multi-Timeseries Classification" description="Classify each time series and provide a global sample classification.">
  <DataSource type="time-series" field="seriesData" />
  
  <Labels>
    <Label name="ecg" type="time-series" count="10" required="true" globalLabel="Sample Classification" commentLabel="Observations">
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
</LabelingInterface>`;
  }
}

export const uiSchemaParser = new UISchemaParser();
