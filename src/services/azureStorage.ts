import { BlobServiceClient, ContainerClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { Annotation, ProjectConfig, SampleInfo } from '../types';

export class AzureStorageService {
  private containerClient: ContainerClient | null = null;
  private config: ProjectConfig | null = null;

  /**
   * Initialize Azure Storage with project configuration
   */
  async initialize(config: ProjectConfig): Promise<void> {
    this.config = config;
    
    const { accountName, containerName } = config.azureStorage;
    
    // Try to use DefaultAzureCredential first (for production with managed identity)
    // Fall back to connection string from environment
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    
    if (connectionString) {
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      this.containerClient = blobServiceClient.getContainerClient(containerName);
    } else {
      // Use DefaultAzureCredential for Azure-hosted environments
      const credential = new DefaultAzureCredential();
      const blobServiceClient = new BlobServiceClient(
        `https://${accountName}.blob.core.windows.net`,
        credential
      );
      this.containerClient = blobServiceClient.getContainerClient(containerName);
    }
  }

  /**
   * Get data for a specific sample
   */
  async getSampleData(sample: SampleInfo): Promise<Buffer | string> {
    if (!this.containerClient || !this.config) {
      throw new Error('Storage service not initialized');
    }

    const blobPath = `${this.config.azureStorage.dataPath}/${sample.fileName}`;
    const blobClient = this.containerClient.getBlobClient(blobPath);
    
    const downloadResponse = await blobClient.download();
    const chunks: Buffer[] = [];
    
    if (downloadResponse.readableStreamBody) {
      for await (const chunk of downloadResponse.readableStreamBody) {
        chunks.push(Buffer.from(chunk));
      }
    }
    
    return Buffer.concat(chunks);
  }

  /**
   * Get a SAS URL for accessing a sample directly (for images/media)
   */
  async getSampleUrl(sample: SampleInfo): Promise<string> {
    if (!this.containerClient || !this.config) {
      throw new Error('Storage service not initialized');
    }

    const blobPath = `${this.config.azureStorage.dataPath}/${sample.fileName}`;
    const blobClient = this.containerClient.getBlobClient(blobPath);
    
    // Check if blob exists
    const exists = await blobClient.exists();
    if (!exists) {
      throw new Error(`Sample not found: ${sample.fileName}`);
    }

    return blobClient.url;
  }

  /**
   * Save an annotation to Azure Blob Storage
   */
  async saveAnnotation(annotation: Annotation): Promise<void> {
    if (!this.containerClient || !this.config) {
      throw new Error('Storage service not initialized');
    }

    const annotationPath = `${this.config.azureStorage.annotationsPath}/${annotation.sampleId}_${annotation.userId}.json`;
    const blockBlobClient = this.containerClient.getBlockBlobClient(annotationPath);
    
    const content = JSON.stringify(annotation, null, 2);
    await blockBlobClient.upload(content, content.length, {
      blobHTTPHeaders: {
        blobContentType: 'application/json'
      }
    });
  }

  /**
   * Get existing annotation for a sample and user
   */
  async getAnnotation(sampleId: string, userId: string): Promise<Annotation | null> {
    if (!this.containerClient || !this.config) {
      throw new Error('Storage service not initialized');
    }

    const annotationPath = `${this.config.azureStorage.annotationsPath}/${sampleId}_${userId}.json`;
    const blobClient = this.containerClient.getBlobClient(annotationPath);
    
    const exists = await blobClient.exists();
    if (!exists) {
      return null;
    }

    const downloadResponse = await blobClient.download();
    const chunks: Buffer[] = [];
    
    if (downloadResponse.readableStreamBody) {
      for await (const chunk of downloadResponse.readableStreamBody) {
        chunks.push(Buffer.from(chunk));
      }
    }
    
    const content = Buffer.concat(chunks).toString('utf-8');
    return JSON.parse(content) as Annotation;
  }

  /**
   * List all annotations for a sample
   */
  async listAnnotationsForSample(sampleId: string): Promise<Annotation[]> {
    if (!this.containerClient || !this.config) {
      throw new Error('Storage service not initialized');
    }

    const prefix = `${this.config.azureStorage.annotationsPath}/${sampleId}_`;
    const annotations: Annotation[] = [];

    for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
      const blobClient = this.containerClient.getBlobClient(blob.name);
      const downloadResponse = await blobClient.download();
      const chunks: Buffer[] = [];
      
      if (downloadResponse.readableStreamBody) {
        for await (const chunk of downloadResponse.readableStreamBody) {
          chunks.push(Buffer.from(chunk));
        }
      }
      
      const content = Buffer.concat(chunks).toString('utf-8');
      annotations.push(JSON.parse(content) as Annotation);
    }

    return annotations;
  }

  /**
   * Get project statistics
   */
  async getProjectStats(): Promise<{ totalSamples: number; annotatedSamples: number }> {
    if (!this.config) {
      throw new Error('Storage service not initialized');
    }

    const totalSamples = this.config.samples.length;
    
    let annotatedSamples = 0;
    if (this.containerClient) {
      const prefix = this.config.azureStorage.annotationsPath + '/';
      const annotatedIds = new Set<string>();

      for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
        const fileName = blob.name.replace(prefix, '');
        const sampleId = fileName.split('_')[0];
        if (sampleId) {
          annotatedIds.add(sampleId);
        }
      }
      
      annotatedSamples = annotatedIds.size;
    }

    return { totalSamples, annotatedSamples };
  }
}

export const storageService = new AzureStorageService();
