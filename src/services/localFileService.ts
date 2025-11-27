import * as fs from 'fs';
import * as path from 'path';
import { SampleInfo, ProjectConfig } from '../types';

/**
 * Service for reading sample data from local filesystem or blob storage URLs
 */
export class LocalFileService {
  private dataPath: string;

  constructor(dataPath: string = './config') {
    this.dataPath = dataPath;
  }

  /**
   * Fetch data from a blob storage URL
   */
  private async fetchFromBlobUrl(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      throw new Error(`Failed to fetch from blob URL ${url}: ${error}`);
    }
  }

  /**
   * Get data for a specific sample from local filesystem or blob storage URL
   */
  async getSampleData(sample: SampleInfo, config?: ProjectConfig): Promise<string> {
    // Check if fileName is a full blob URL
    if (sample.fileName && sample.fileName.startsWith('http')) {
      return this.fetchFromBlobUrl(sample.fileName);
    }

    // Otherwise, use local filesystem
    const basePath = config?.azureStorage?.dataPath || 'config';
    const filePath = path.join(this.dataPath, basePath, sample.fileName);
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return content;
    } catch (error) {
      throw new Error(`Failed to read sample file at ${filePath}: ${sample.fileName}`);
    }
  }

  /**
   * Get a URL/path for accessing a sample (for images)
   */
  async getSampleUrl(sample: SampleInfo): Promise<string> {
    // For local files, return a file path or URL
    return `/files/${sample.fileName}`;
  }
}

export const localFileService = new LocalFileService();
