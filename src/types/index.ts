// Sample control configuration types
export interface SampleControlConfig {
  disableSkip?: boolean;
  disablePrevious?: boolean;
  disableNext?: boolean;
  filterAnnotatedSamples?: boolean;
  requireSubmitToNavigate?: boolean;
}

// Sample task configuration for external task file
export interface SampleTaskConfig {
  fileName: string;
}

// Configuration types
export interface ProjectConfig {
  projectId: string;
  projectName: string;
  description: string;
  azureStorage: {
    accountName: string;
    containerName: string;
    dataPath: string;
    annotationsPath: string;
  };
  authentication: {
    azureB2C: {
      tenantId: string;
      clientId: string;
      authority: string;
      redirectUri: string;
      scopes: string[];
    };
  };
  sampleTask?: SampleTaskConfig | null;
  samples: SampleInfo[];
  sampleControl?: SampleControlConfig;
}

export interface SampleInfo {
  id: string;
  fileName: string;
  type: 'image' | 'text' | 'audio' | 'video' | 'time-series';
  metadata?: {
    channelCount?: number;
    [key: string]: any;
  };
}

// Help resource types
export interface HelpResource {
  type: 'video' | 'pdf' | 'text' | 'audio' | 'link';
  title: string;
  url?: string;
  content?: string;
}

export interface HelpConfig {
  title?: string;
  showOnLoad?: boolean;
  resources: HelpResource[];
}

// UI Schema types (parsed from UI.xml)
export interface UISchema {
  labelingInterface: {
    title: string;
    description?: string;
    dataSource: DataSource;
    labels: LabelConfig[];
    layout?: LayoutConfig;
    customStyles?: string;
    help?: HelpConfig;
    sampleControl?: SampleControlConfig;
  };
}

export interface DataSource {
  type: 'image' | 'text' | 'audio' | 'video' | 'time-series';
  field: string;
}

export interface LabelConfig {
  name: string;
  type: 'classification' | 'bounding-box' | 'polygon' | 'text-input' | 'choices' | 'rating' | 'time-series';
  required?: boolean;
  options?: LabelOption[];
  min?: number;
  max?: number;
  multiSelect?: boolean;
  cssClass?: string;
  // Subtitle for regular labels (choices, classification)
  subtitle?: string;
  subtitlePosition?: 'above' | 'below';
  // Time-series specific fields
  count?: number;
  axis?: AxisConfig;
  seriesOptions?: LabelOption[];
  globalOptions?: LabelOption[];
  globalLabel?: string;
  commentLabel?: string;
  showSeriesTitles?: boolean;
  seriesTitles?: string[];
  xAxisTickSize?: number;
  buttonSize?: 'small' | 'medium' | 'large';
  // Subtitle for time-series series options
  seriesSubtitle?: string;
  seriesSubtitlePosition?: 'above' | 'below';
  // Subtitle for time-series global options
  globalSubtitle?: string;
  globalSubtitlePosition?: 'above' | 'below';
}

export interface AxisConfig {
  min?: number;
  max?: number;
}

export interface LabelOption {
  value: string;
  label: string;
  hotkey?: string;
  color?: string;
  hidden?: boolean;
}

export interface LayoutConfig {
  columns?: number;
  showProgress?: boolean;
  showInstructions?: boolean;
  cssClass?: string;
  spacing?: 'compact' | 'normal' | 'comfortable';
}

// Annotation types
export interface Annotation {
  id: string;
  sampleId: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  timestamp: string;
  labels: Record<string, AnnotationValue>;
  status: 'draft' | 'submitted';
  // Azure credential metadata for tracking
  azureObjectId?: string;
  tenantId?: string;
}

export type AnnotationValue = 
  | string 
  | string[] 
  | number 
  | BoundingBox 
  | BoundingBox[] 
  | Polygon 
  | Polygon[]
  | TimeSeriesAnnotation;

export interface TimeSeriesAnnotation {
  seriesLabels: Record<string, string>;
  globalLabel: string;
  comment?: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface Polygon {
  points: { x: number; y: number }[];
  label?: string;
}

// Session types
export interface UserSession {
  userId: string;
  email: string;
  name: string;
  roles: string[];
}
