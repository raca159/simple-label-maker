import { parseString } from 'xml2js';
import { promisify } from 'util';
import { UISchema, LabelConfig, DataSource, LayoutConfig, LabelOption, AxisConfig, HelpConfig, HelpResource, SampleControlConfig } from '../types';

const parseXml = promisify(parseString);

// Common type alias for parsed options
type ParsedOptionArray = Array<{
  $?: {
    value?: string;
    label?: string;
    hotkey?: string;
    color?: string;
    hidden?: string;
  };
}>;

// Type for nested options container (SeriesOptions, GlobalOptions)
type NestedOptionsArray = Array<{
  $?: {
    subtitle?: string;
    subtitlePosition?: string;
  };
  Option?: ParsedOptionArray;
}>;

// Type for parsed Help element
type ParsedHelpArray = Array<{
  $?: {
    title?: string;
    showOnLoad?: string;
  };
  Resource?: Array<{
    $?: {
      type?: string;
      title?: string;
      url?: string;
    };
    _?: string;
  }>;
}>;

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
    Style?: string[];
    Help?: ParsedHelpArray;
    SampleControl?: Array<{
      $?: {
        disableSkip?: string;
        disablePrevious?: string;
        disableNext?: string;
        filterAnnotatedSamples?: string;
        requireSubmitToNavigate?: string;
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
    cssClass?: string;
    showSeriesTitles?: string;
    xAxisTickSize?: string;
    buttonSize?: string;
    subtitle?: string;
    subtitlePosition?: string;
  };
  Option?: ParsedOptionArray;
  SeriesOptions?: NestedOptionsArray;
  GlobalOptions?: NestedOptionsArray;
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
        layout: this.parseLayout(li.Layout),
        customStyles: this.parseCustomStyles(li.Style),
        help: this.parseHelp(li.Help),
        sampleControl: this.parseSampleControl(li.SampleControl)
      }
    };
  }

  private parseHelp(helpArray?: ParsedHelpArray): HelpConfig | undefined {
    const help = helpArray?.[0];
    if (!help) return undefined;

    const validResourceTypes: HelpResource['type'][] = ['video', 'pdf', 'text', 'audio', 'link'];
    
    const resources: HelpResource[] = (help.Resource ?? []).map((res): HelpResource => {
      const rawType = res.$?.type ?? 'link';
      const type = validResourceTypes.includes(rawType as HelpResource['type'])
        ? rawType as HelpResource['type']
        : 'link';

      return {
        type,
        title: res.$?.title ?? 'Untitled Resource',
        url: res.$?.url,
        content: res._ // Text content inside the Resource element
      };
    });

    // Return undefined if no resources are defined to prevent showing an empty modal
    if (resources.length === 0) {
      return undefined;
    }

    return {
      title: help.$?.title ?? 'Help & Guides',
      // Default to true if not explicitly set to 'false'
      showOnLoad: help.$?.showOnLoad === undefined || help.$?.showOnLoad === 'true',
      resources
    };
  }

  private parseCustomStyles(styleArray?: string[]): string | undefined {
    if (!styleArray || styleArray.length === 0) {
      return undefined;
    }
    // The Style element content is in the first array element
    // Note: Custom styles come from UI.xml which is a project configuration file
    // managed by administrators. This follows the same pattern as Label Studio.
    const styles = styleArray[0];
    if (typeof styles === 'string' && styles.trim()) {
      const trimmed = styles.trim();
      // Basic check: CSS typically contains braces or @-rules
      if (trimmed.includes('{') || trimmed.startsWith('@')) {
        return trimmed;
      }
      console.warn('Style content does not appear to be valid CSS');
    }
    return undefined;
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
      
      const validSubtitlePositions: Array<'above' | 'below'> = ['above', 'below'];
      const subtitlePosition = attrs.subtitlePosition && validSubtitlePositions.includes(attrs.subtitlePosition as any)
        ? attrs.subtitlePosition as 'above' | 'below'
        : 'below'; // default to below
      
      const config: LabelConfig = {
        name: attrs.name ?? 'label',
        type,
        required: attrs.required === 'true',
        multiSelect: attrs.multiSelect === 'true',
        min: attrs.min ? parseInt(attrs.min, 10) : undefined,
        max: attrs.max ? parseInt(attrs.max, 10) : undefined,
        cssClass: attrs.cssClass,
        subtitle: attrs.subtitle,
        subtitlePosition: attrs.subtitle ? subtitlePosition : undefined,
        options: this.parseOptions(label.Option)
      };

      // Time-series specific parsing
      if (type === 'time-series') {
        config.count = attrs.count ? parseInt(attrs.count, 10) : 10;
        config.globalLabel = attrs.globalLabel;
        config.commentLabel = attrs.commentLabel;
        config.showSeriesTitles = attrs.showSeriesTitles === 'true';
        config.xAxisTickSize = attrs.xAxisTickSize ? parseInt(attrs.xAxisTickSize, 10) : 11;
        config.buttonSize = attrs.buttonSize as 'small' | 'medium' | 'large' | undefined;
        config.axis = this.parseAxis(label.Axis);
        
        // Parse series options with subtitle
        const seriesOptionsData = this.parseOptionsWithSubtitle(label.SeriesOptions);
        config.seriesOptions = seriesOptionsData.options;
        config.seriesSubtitle = seriesOptionsData.subtitle;
        config.seriesSubtitlePosition = seriesOptionsData.subtitlePosition;
        
        // Parse global options with subtitle
        const globalOptionsData = this.parseOptionsWithSubtitle(label.GlobalOptions);
        config.globalOptions = globalOptionsData.options;
        config.globalSubtitle = globalOptionsData.subtitle;
        config.globalSubtitlePosition = globalOptionsData.subtitlePosition;
      }

      return config;
    });
  }

  private parseOptions(options?: ParsedOptionArray): LabelOption[] | undefined {
    if (!options || options.length === 0) {
      return undefined;
    }

    return options.map((opt): LabelOption => ({
      value: opt.$?.value ?? '',
      label: opt.$?.label ?? opt.$?.value ?? '',
      hotkey: opt.$?.hotkey,
      color: opt.$?.color,
      hidden: opt.$?.hidden === 'true'
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

  private parseOptionsWithSubtitle(optionsArray?: NestedOptionsArray): {
    options?: LabelOption[];
    subtitle?: string;
    subtitlePosition?: 'above' | 'below';
  } {
    if (!optionsArray || optionsArray.length === 0) {
      return { options: undefined };
    }

    const optionsContainer = optionsArray[0];
    const options = this.parseOptions(optionsContainer?.Option);
    
    const validSubtitlePositions: Array<'above' | 'below'> = ['above', 'below'];
    const subtitlePosition = optionsContainer?.$?.subtitlePosition && 
      validSubtitlePositions.includes(optionsContainer.$.subtitlePosition as any)
      ? optionsContainer.$.subtitlePosition as 'above' | 'below'
      : 'below'; // default to below

    return {
      options,
      subtitle: optionsContainer?.$?.subtitle,
      subtitlePosition: optionsContainer?.$?.subtitle ? subtitlePosition : undefined
    };
  }

  private parseSeriesOptions(seriesOptionsArray?: NestedOptionsArray): LabelOption[] | undefined {
    const seriesOptions = seriesOptionsArray?.[0]?.Option;
    return this.parseOptions(seriesOptions);
  }

  private parseGlobalOptions(globalOptionsArray?: NestedOptionsArray): LabelOption[] | undefined {
    const globalOptions = globalOptionsArray?.[0]?.Option;
    return this.parseOptions(globalOptions);
  }

  private parseLayout(layouts?: Array<{ $?: { columns?: string; showProgress?: string; showInstructions?: string; cssClass?: string; spacing?: string } }>): LayoutConfig | undefined {
    const layout = layouts?.[0]?.$;
    if (!layout) return undefined;

    const validSpacing: Array<'compact' | 'normal' | 'comfortable'> = ['compact', 'normal', 'comfortable'];
    const spacing = layout.spacing && validSpacing.includes(layout.spacing as any) 
      ? layout.spacing as 'compact' | 'normal' | 'comfortable'
      : undefined;

    return {
      columns: layout.columns ? parseInt(layout.columns, 10) : undefined,
      showProgress: layout.showProgress === 'true',
      showInstructions: layout.showInstructions === 'true',
      cssClass: layout.cssClass,
      spacing
    };
  }

  private parseSampleControl(sampleControlArray?: Array<{ $?: { disableSkip?: string; disablePrevious?: string; disableNext?: string; filterAnnotatedSamples?: string; requireSubmitToNavigate?: string } }>): SampleControlConfig | undefined {
    const sampleControl = sampleControlArray?.[0];
    if (!sampleControl?.$) return undefined;

    return {
      disableSkip: sampleControl.$.disableSkip === 'true',
      disablePrevious: sampleControl.$.disablePrevious === 'true',
      disableNext: sampleControl.$.disableNext === 'true',
      filterAnnotatedSamples: sampleControl.$.filterAnnotatedSamples === 'true',
      requireSubmitToNavigate: sampleControl.$.requireSubmitToNavigate === 'true'
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
