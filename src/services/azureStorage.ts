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
   * Uses user-based subdirectories: {annotationsPath}/{userId}/{sampleId}.json
   */
  async saveAnnotation(annotation: Annotation): Promise<void> {
    if (!this.containerClient || !this.config) {
      throw new Error('Storage service not initialized');
    }

    // Create user-based subdirectory structure
    const annotationPath = `${this.config.azureStorage.annotationsPath}/${annotation.userId}/${annotation.sampleId}.json`;
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
   * Reads from user-based subdirectory: {annotationsPath}/{userId}/{sampleId}.json
   */
  async getAnnotation(sampleId: string, userId: string): Promise<Annotation | null> {
    if (!this.containerClient || !this.config) {
      throw new Error('Storage service not initialized');
    }

    // Use user-based subdirectory structure
    const annotationPath = `${this.config.azureStorage.annotationsPath}/${userId}/${sampleId}.json`;
    const blobClient = this.containerClient.getBlobClient(annotationPath);
    
    const exists = await blobClient.exists();
    if (!exists) {
      // Try legacy flat structure for backward compatibility
      const legacyPath = `${this.config.azureStorage.annotationsPath}/${sampleId}_${userId}.json`;
      const legacyBlobClient = this.containerClient.getBlobClient(legacyPath);
      const legacyExists = await legacyBlobClient.exists();
      
      if (!legacyExists) {
        return null;
      }
      
      // Read from legacy location
      const downloadResponse = await legacyBlobClient.download();
      const chunks: Buffer[] = [];
      
      if (downloadResponse.readableStreamBody) {
        for await (const chunk of downloadResponse.readableStreamBody) {
          chunks.push(Buffer.from(chunk));
        }
      }
      
      const content = Buffer.concat(chunks).toString('utf-8');
      return JSON.parse(content) as Annotation;
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
   * List all annotations for a sample across all users
   * Searches through user subdirectories for annotations matching the sample ID
   */
  async listAnnotationsForSample(sampleId: string): Promise<Annotation[]> {
    if (!this.containerClient || !this.config) {
      throw new Error('Storage service not initialized');
    }

    const annotations: Annotation[] = [];
    const prefix = `${this.config.azureStorage.annotationsPath}/`;

    // Search through all blobs in annotations path (including user subdirectories)
    for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
      // Check if this blob matches the sample ID
      // New structure: annotations/{userId}/{sampleId}.json
      // Legacy structure: annotations/{sampleId}_{userId}.json
      const blobName = blob.name.replace(prefix, '');
      const isNewStructure = blobName.includes('/') && blobName.endsWith(`/${sampleId}.json`);
      const isLegacyStructure = blobName.startsWith(`${sampleId}_`) && blobName.endsWith('.json');
      
      if (isNewStructure || isLegacyStructure) {
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
    }

    return annotations;
  }

  /**
   * Get project statistics
   * Counts unique annotated samples across both new (user subdirectory) and legacy (flat) structures
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
        
        // New structure: {userId}/{sampleId}.json
        if (fileName.includes('/')) {
          const parts = fileName.split('/');
          if (parts.length >= 2) {
            const sampleId = parts[1]?.replace('.json', '');
            if (sampleId) {
              annotatedIds.add(sampleId);
            }
          }
        } else {
          // Legacy structure: {sampleId}_{userId}.json
          const sampleId = fileName.split('_')[0];
          if (sampleId) {
            annotatedIds.add(sampleId);
          }
        }
      }
      
      annotatedSamples = annotatedIds.size;
    }

    return { totalSamples, annotatedSamples };
  }

  /**
   * Get set of sample IDs that have been annotated by a specific user
   * Searches in user-specific subdirectory: {annotationsPath}/{userId}/
   */
  async getAnnotatedSampleIdsForUser(userId: string): Promise<Set<string>> {
    const annotatedIds = new Set<string>();
    
    if (!this.containerClient || !this.config) {
      return annotatedIds;
    }

    // Search in user-specific subdirectory first (new structure)
    const userPrefix = `${this.config.azureStorage.annotationsPath}/${userId}/`;
    
    for await (const blob of this.containerClient.listBlobsFlat({ prefix: userPrefix })) {
      const fileName = blob.name.replace(userPrefix, '');
      // New structure: annotations/{userId}/{sampleId}.json
      const sampleId = fileName.replace('.json', '');
      annotatedIds.add(sampleId);
    }

    // Also check legacy flat structure for backward compatibility
    const legacyPrefix = this.config.azureStorage.annotationsPath + '/';
    
    for await (const blob of this.containerClient.listBlobsFlat({ prefix: legacyPrefix })) {
      const fileName = blob.name.replace(legacyPrefix, '');
      // Skip files that are in subdirectories (new structure)
      if (fileName.includes('/')) {
        continue;
      }
      // Legacy structure: annotations/{sampleId}_{userId}.json
      const parts = fileName.replace('.json', '').split('_');
      if (parts.length >= 2) {
        const sampleId = parts.slice(0, -1).join('_'); // Handle sample IDs with underscores
        const annotationUserId = parts[parts.length - 1];
        if (annotationUserId === userId) {
          annotatedIds.add(sampleId);
        }
      }
    }

    return annotatedIds;
  }
}

export const storageService = new AzureStorageService();
