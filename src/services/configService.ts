import * as fs from 'fs';
import * as path from 'path';
import { ProjectConfig, UISchema, SampleControlConfig, SampleInfo } from '../types';
import { uiSchemaParser } from './uiSchemaParser';

export class ConfigService {
  private config: ProjectConfig | null = null;
  private uiSchema: UISchema | null = null;
  private configDir: string = '';

  /**
   * Load project configuration from file
   */
  async loadConfig(configPath: string): Promise<ProjectConfig> {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    this.config = JSON.parse(configContent) as ProjectConfig;
    this.configDir = path.dirname(configPath);
    
    // Load samples from external file if sampleTask is specified
    await this.loadSamplesFromTaskFile();
    
    return this.config;
  }

  /**
   * Load samples from external task file if sampleTask is configured
   */
  private async loadSamplesFromTaskFile(): Promise<void> {
    if (!this.config) {
      return;
    }

    // Check if sampleTask is configured and not null
    if (this.config.sampleTask && this.config.sampleTask.fileName) {
      try {
        let taskFileContent: string;
        const fileName = this.config.sampleTask.fileName;

        // Check if fileName is a URL
        if (fileName.startsWith('http://') || fileName.startsWith('https://')) {
          // Fetch from URL
          const response = await fetch(fileName);
          if (!response.ok) {
            throw new Error(`Failed to fetch task file from URL: ${response.status} ${response.statusText}`);
          }
          taskFileContent = await response.text();
        } else {
          // Handle as local file path
          const taskFilePath = path.isAbsolute(fileName)
            ? fileName
            : path.join(this.configDir, fileName);

          // Load the task file asynchronously
          taskFileContent = await fs.promises.readFile(taskFilePath, 'utf-8');
        }

        let samples: SampleInfo[];
        try {
          samples = JSON.parse(taskFileContent) as SampleInfo[];
        } catch (parseError) {
          throw new Error(`Failed to parse JSON in task file '${fileName}': ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        }

        // Validate that the task file contains an array of samples
        if (!Array.isArray(samples)) {
          throw new Error(`Task file '${fileName}' must contain an array of samples`);
        }

        // Validate structure of each sample and ensure unique IDs
        const seenIds = new Set<string>();
        samples.forEach((sample, index) => {
          if (sample == null || typeof sample !== 'object') {
            throw new Error(
              `Sample at index ${index} in task file '${fileName}' must be a non-null object`
            );
          }

          const { id, fileName: sampleFileName, type } = sample as SampleInfo;

          if (typeof id !== 'string' || id.trim() === '') {
            throw new Error(
              `Sample at index ${index} in task file '${fileName}' must have a non-empty 'id' string property`
            );
          }

          if (typeof sampleFileName !== 'string' || sampleFileName.trim() === '') {
            throw new Error(
              `Sample '${id}' in task file '${fileName}' must have a non-empty 'fileName' string property`
            );
          }

          if (typeof type !== 'string' || type.trim() === '') {
            throw new Error(
              `Sample '${id}' in task file '${fileName}' must have a non-empty 'type' string property`
            );
          }

          if (seenIds.has(id)) {
            throw new Error(
              `Duplicate sample id '${id}' found in task file '${fileName}'`
            );
          }

          seenIds.add(id);
        });

        // Replace the samples array with the loaded samples
        this.config.samples = samples;

        console.log(`Loaded ${samples.length} samples from task file: ${fileName}`);
      } catch (error) {
        console.error('Failed to load samples from task file:', error);
        throw new Error(`Failed to load samples from task file: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Load UI schema from XML file
   */
  async loadUISchema(uiXmlPath: string): Promise<UISchema> {
    const xmlContent = fs.readFileSync(uiXmlPath, 'utf-8');
    this.uiSchema = await uiSchemaParser.parse(xmlContent);
    return this.uiSchema;
  }

  /**
   * Get the current configuration
   */
  getConfig(): ProjectConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }
    return this.config;
  }

  /**
   * Get the current UI schema
   */
  getUISchema(): UISchema {
    if (!this.uiSchema) {
      throw new Error('UI Schema not loaded');
    }
    return this.uiSchema;
  }

  /**
   * Get sample by ID
   */
  getSampleById(sampleId: string) {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }
    return this.config.samples.find(s => s.id === sampleId);
  }

  /**
   * Get next sample for labeling
   */
  getNextSample(currentSampleId?: string) {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }
    
    if (!currentSampleId) {
      return this.config.samples[0];
    }

    const currentIndex = this.config.samples.findIndex(s => s.id === currentSampleId);
    if (currentIndex === -1 || currentIndex >= this.config.samples.length - 1) {
      return null;
    }

    return this.config.samples[currentIndex + 1];
  }

  /**
   * Get previous sample for labeling
   */
  getPreviousSample(currentSampleId: string) {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    const currentIndex = this.config.samples.findIndex(s => s.id === currentSampleId);
    if (currentIndex <= 0) {
      return null;
    }

    return this.config.samples[currentIndex - 1];
  }

  /**
   * Get sample control configuration
   */
  getSampleControlConfig(): SampleControlConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }
    return this.config.sampleControl ?? {};
  }

  /**
   * Create default configuration file
   */
  createDefaultConfig(outputPath: string): void {
    const defaultConfig: ProjectConfig = {
      projectId: 'sample-project',
      projectName: 'Sample Labeling Project',
      description: 'A sample data labeling project',
      azureStorage: {
        accountName: 'your-storage-account',
        containerName: 'labeling-data',
        dataPath: 'samples',
        annotationsPath: 'annotations'
      },
      authentication: {
        azureB2C: {
          tenantId: 'your-tenant-id',
          clientId: 'your-client-id',
          authority: 'https://your-tenant.b2clogin.com/your-tenant.onmicrosoft.com/B2C_1_signupsignin',
          redirectUri: 'http://localhost:3000/auth/callback',
          scopes: ['openid', 'profile', 'email']
        }
      },
      samples: [
        {
          id: 'sample-001',
          fileName: 'image1.jpg',
          type: 'image',
          metadata: {
            source: 'example'
          }
        },
        {
          id: 'sample-002',
          fileName: 'image2.jpg',
          type: 'image',
          metadata: {
            source: 'example'
          }
        },
        {
          id: 'sample-003',
          fileName: 'document1.txt',
          type: 'text',
          metadata: {
            source: 'example'
          }
        }
      ]
    };

    fs.writeFileSync(outputPath, JSON.stringify(defaultConfig, null, 2));
  }

  /**
   * Create default UI.xml file
   */
  createDefaultUIXml(outputPath: string): void {
    const defaultXml = uiSchemaParser.generateDefaultXml();
    fs.writeFileSync(outputPath, defaultXml);
  }
}

export const configService = new ConfigService();
