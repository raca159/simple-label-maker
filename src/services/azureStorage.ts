import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { Annotation, ProjectConfig, SampleInfo } from '../types';

export class AzureStorageService {
  private containerClient: ContainerClient | null = null;
  private config: ProjectConfig | null = null;

  /**
   * Sanitize a string to prevent path traversal attacks
   * Removes directory separators, path traversal sequences, and URL-encoded variants
   */
  private sanitizePath(input: string): string {
    if (!input || input.trim() === '') {
      throw new Error('Path component cannot be empty');
    }
    // Decode URL encoding first to catch encoded path traversal attempts
    let decoded = input;
    try {
      decoded = decodeURIComponent(input);
    } catch {
      // If decoding fails, continue with original input
    }
    // Remove any path traversal sequences, directory separators, and null bytes
    const sanitized = decoded.replace(/[\/\\\.%\x00]/g, '_');
    if (sanitized !== input) {
      console.warn(`Path component sanitized: "${input}" -> "${sanitized}"`);
    }
    return sanitized;
  }

  /**
   * Download blob content and parse as JSON
   */
  private async downloadBlobAsJson<T>(blobClient: { download: () => Promise<any>; name?: string }): Promise<T> {
    const downloadResponse = await blobClient.download();
    const chunks: Buffer[] = [];
    
    if (downloadResponse.readableStreamBody) {
      for await (const chunk of downloadResponse.readableStreamBody) {
        chunks.push(Buffer.from(chunk));
      }
    }
    
    const content = Buffer.concat(chunks).toString('utf-8');
    try {
      return JSON.parse(content) as T;
    } catch (error) {
      const blobPath = blobClient.name || 'unknown';
      throw new Error(`Failed to parse JSON from blob ${blobPath}: ${error}`);
    }
  }

  /**
   * Initialize Azure Storage with project configuration
   */
  async initialize(config: ProjectConfig): Promise<void> {
    this.config = config;
    
    const { accountName, containerName } = config.azureStorage;
    const connectionString = process.env.STORAGE_CONN_STR;
    
    // Use connection string from environment variable
    if (!connectionString) {
      console.error('❌ [AZURE STORAGE] Failed to initialize: STORAGE_CONN_STR not set');
      console.error('   Storage account: ' + accountName);
      throw new Error('Azure Storage initialization failed: STORAGE_CONN_STR environment variable not set');
    }
    
    try {
      console.log('🔐 [AZURE STORAGE] Initializing with connection string...');
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      this.containerClient = blobServiceClient.getContainerClient(containerName);
      
      // Verify credentials work by getting container properties
      await this.containerClient.getProperties();
      console.log('✅ [AZURE STORAGE] Successfully initialized with connection string');
    } catch (error) {
      const errorMsg = (error as Error).message;
      console.error(`❌ [AZURE STORAGE] Initialization failed: ${errorMsg}`);
      throw error;
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

    // If fileName is already a full URL, return it as-is
    if (sample.fileName.startsWith('http')) {
      return sample.fileName;
    }

    // Otherwise, build blob path and get its URL
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

    // Validate and sanitize inputs to prevent path traversal
    const sanitizedUserId = this.sanitizePath(annotation.userId);
    const sanitizedSampleId = this.sanitizePath(annotation.sampleId);

    // Create user-based subdirectory structure
    const annotationPath = `${this.config.azureStorage.annotationsPath}/${sanitizedUserId}/${sanitizedSampleId}.json`;
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
   * Reads from user-based subdirectory, falls back to legacy flat structure if not found.
   */
  async getAnnotation(sampleId: string, userId: string): Promise<Annotation | null> {
    if (!this.containerClient || !this.config) {
      throw new Error('Storage service not initialized');
    }

    // Validate and sanitize inputs to prevent path traversal
    const sanitizedUserId = this.sanitizePath(userId);
    const sanitizedSampleId = this.sanitizePath(sampleId);

    // Use user-based subdirectory structure
    const annotationPath = `${this.config.azureStorage.annotationsPath}/${sanitizedUserId}/${sanitizedSampleId}.json`;
    const blobClient = this.containerClient.getBlobClient(annotationPath);
    
    const exists = await blobClient.exists();
    if (!exists) {
      // Try legacy flat structure for backward compatibility
      const legacyPath = `${this.config.azureStorage.annotationsPath}/${sanitizedSampleId}_${sanitizedUserId}.json`;
      const legacyBlobClient = this.containerClient.getBlobClient(legacyPath);
      const legacyExists = await legacyBlobClient.exists();
      
      if (!legacyExists) {
        return null;
      }
      
      // Read from legacy location
      return this.downloadBlobAsJson<Annotation>(legacyBlobClient);
    }

    return this.downloadBlobAsJson<Annotation>(blobClient);
  }

  /**
   * List all annotations for a sample across all users
   * Searches through user subdirectories for annotations matching the sample ID
   * Note: Azure Blob Storage doesn't support wildcard patterns such as annotations/*\/sampleId.json,
   * so we must list all blobs and filter by pattern
   */
  async listAnnotationsForSample(sampleId: string): Promise<Annotation[]> {
    if (!this.containerClient || !this.config) {
      throw new Error('Storage service not initialized');
    }

    // Validate input to prevent empty string issues
    const sanitizedSampleId = this.sanitizePath(sampleId);

    const annotations: Annotation[] = [];
    const prefix = `${this.config.azureStorage.annotationsPath}/`;

    // Search through all blobs in annotations path (including user subdirectories)
    for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
      // Check if this blob matches the sample ID
      // New structure: annotations/{userId}/{sampleId}.json
      // Legacy structure: annotations/{sampleId}_{userId}.json
      const blobName = blob.name.replace(prefix, '');
      
      // Validate new structure has exactly 2 path segments
      const pathSegments = blobName.split('/');
      const isNewStructure =
        pathSegments.length === 2 &&
        pathSegments[0] && pathSegments[0].length > 0 &&
        pathSegments[1] === `${sanitizedSampleId}.json`;
      const isLegacyStructure = blobName.startsWith(`${sanitizedSampleId}_`) && blobName.endsWith('.json');
      
      if (isNewStructure || isLegacyStructure) {
        const blobClient = this.containerClient.getBlobClient(blob.name);
        const annotation = await this.downloadBlobAsJson<Annotation>(blobClient);
        annotations.push(annotation);
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
        
        // New structure: {userId}/{sampleId}.json - validate exactly 2 segments
        if (fileName.includes('/')) {
          const parts = fileName.split('/');
          if (parts.length === 2 && parts[1] && parts[1].endsWith('.json')) {
            const sampleId = parts[1].replace('.json', '');
            if (sampleId && sampleId !== '') {
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

    // Validate and sanitize userId to prevent path traversal
    const sanitizedUserId = this.sanitizePath(userId);

    // Search in user-specific subdirectory first (new structure)
    const userPrefix = `${this.config.azureStorage.annotationsPath}/${sanitizedUserId}/`;
    
    for await (const blob of this.containerClient.listBlobsFlat({ prefix: userPrefix })) {
      const fileName = blob.name.replace(userPrefix, '');
      // New structure: annotations/{userId}/{sampleId}.json - filter by .json extension
      if (fileName.endsWith('.json')) {
        const sampleId = fileName.replace('.json', '');
        if (sampleId && sampleId !== '') {
          annotatedIds.add(sampleId);
        }
      }
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
        if (annotationUserId === sanitizedUserId) {
          annotatedIds.add(sampleId);
        }
      }
    }

    return annotatedIds;
  }
}

export const storageService = new AzureStorageService();
