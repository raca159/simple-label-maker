import { Router, Request, Response } from 'express';
import { configService } from '../services/configService';
import { storageService } from '../services/azureStorage';
import { localFileService } from '../services/localFileService';
import { CSVParser } from '../services/csvParser';
import { Annotation, UserSession } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Extended request type with user session from Azure B2C
interface AuthenticatedRequest extends Request {
  user?: UserSession & {
    azureObjectId?: string;
    tenantId?: string;
  };
}

const router = Router();

// Get current user information (for debugging authentication)
router.get('/me', (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user || {
      userId: 'demo-user',
      name: 'Demo User',
      email: 'demo@example.com',
      authenticated: false
    };

    console.log('👤 [/me ENDPOINT] User info requested:', user);

    res.json({
      ...user,
      authenticated: !!authReq.user,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [/me ENDPOINT] Error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Get project information
router.get('/project', (req: Request, res: Response) => {
  try {
    const config = configService.getConfig();
    const sampleControl = configService.getSampleControlConfig();
    res.json({
      projectId: config.projectId,
      projectName: config.projectName,
      description: config.description,
      totalSamples: config.samples.length,
      sampleControl: sampleControl
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get project info' });
  }
});

// Get UI schema
router.get('/ui-schema', (req: Request, res: Response) => {
  try {
    const uiSchema = configService.getUISchema();
    res.json(uiSchema);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get UI schema' });
  }
});

// Get all samples
router.get('/samples', (req: Request, res: Response) => {
  try {
    const config = configService.getConfig();
    res.json(config.samples);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get samples' });
  }
});

// Get filtered samples for the current user (excludes already annotated samples if configured)
router.get('/samples/filtered', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const config = configService.getConfig();
    const sampleControl = configService.getSampleControlConfig();
    
    // If filtering is not enabled, return all samples
    if (!sampleControl.filterAnnotatedSamples) {
      res.json({
        samples: config.samples,
        totalSamples: config.samples.length,
        remainingSamples: config.samples.length
      });
      return;
    }
    
    // Get user ID for filtering
    const userId = authReq.user?.userId ?? authReq.user?.azureObjectId ?? 'demo-user';
    
    // For demo mode without Azure, check localStorage on frontend instead
    if (!process.env.STORAGE_CONN_STR) {
      res.json({
        samples: config.samples,
        totalSamples: config.samples.length,
        remainingSamples: config.samples.length,
        filterOnClient: true // Signal frontend to filter using localStorage
      });
      return;
    }
    
    // Get annotated sample IDs for this user from Azure
    const annotatedSampleIds = await storageService.getAnnotatedSampleIdsForUser(userId);
    
    // Filter out already annotated samples
    const filteredSamples = config.samples.filter(s => !annotatedSampleIds.has(s.id));
    
    res.json({
      samples: filteredSamples,
      totalSamples: config.samples.length,
      remainingSamples: filteredSamples.length,
      annotatedCount: annotatedSampleIds.size
    });
  } catch (error) {
    console.error('Failed to get filtered samples:', error);
    res.status(500).json({ error: 'Failed to get filtered samples' });
  }
});

// Get resume position for current user (next sample to label)
// Returns annotated count, total samples, and next sample ID to resume from
// Query param: currentSampleId - if provided, finds next unannotated sample AFTER this one
router.get('/resume-position', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const config = configService.getConfig();
    const sampleControl = configService.getSampleControlConfig();
    
    const userId = authReq.user?.userId ?? authReq.user?.azureObjectId ?? 'demo-user';
    const totalSamples = config.samples.length;
    const currentSampleId = req.query.currentSampleId as string | undefined;
    
    console.log('🔄 [RESUME] User ID:', userId);
    console.log('🔄 [RESUME] Total samples:', totalSamples);
    console.log('🔄 [RESUME] Current sample ID:', currentSampleId || 'none (fresh start)');
    console.log('🔄 [RESUME] Sample IDs in config:', config.samples.map(s => s.id).slice(0, 10));
    console.log('🔄 [RESUME] STORAGE_CONN_STR set:', !!process.env.STORAGE_CONN_STR);
    
    // For demo mode without Azure, no resume support
    if (!process.env.STORAGE_CONN_STR) {
      console.log('⚠️  [RESUME] No Azure storage configured, resume not supported');
      res.json({
        annotatedCount: 0,
        totalSamples: totalSamples,
        nextSampleId: config.samples.length > 0 ? config.samples[0].id : null,
        nextSampleIndex: 0,
        supportsResume: false,
        message: 'Resume not supported in demo mode (no Azure storage)'
      });
      return;
    }

    // Get annotated sample IDs for this user from Azure
    const annotatedSampleIds = await storageService.getAnnotatedSampleIdsForUser(userId);
    const annotatedCount = annotatedSampleIds.size;
    
    console.log('🔄 [RESUME] Annotated count for user:', annotatedCount);
    console.log('🔄 [RESUME] Annotated sample IDs:', Array.from(annotatedSampleIds));

    // Find the next unannotated sample
    // If currentSampleId is provided, start searching AFTER that sample
    // Otherwise, find the first unannotated sample from the beginning
    let nextSampleId = null;
    let nextSampleIndex = 0;
    let startIndex = 0;
    
    if (currentSampleId) {
      // Find the index of the current sample and start after it
      const currentIndex = config.samples.findIndex(s => s.id === currentSampleId);
      if (currentIndex >= 0) {
        startIndex = currentIndex + 1;
        console.log('🔄 [RESUME] Starting search after current sample at index', currentIndex);
      }
    }

    for (let i = startIndex; i < config.samples.length; i++) {
      if (!annotatedSampleIds.has(config.samples[i].id)) {
        nextSampleId = config.samples[i].id;
        nextSampleIndex = i;
        console.log('🔄 [RESUME] Next unannotated sample found at index', i, ':', nextSampleId);
        break;
      }
    }
    
    if (nextSampleId === null) {
      console.log('🔄 [RESUME] No more unannotated samples found after index', startIndex);
    }

    const response = {
      annotatedCount: annotatedCount,
      totalSamples: totalSamples,
      nextSampleId: nextSampleId,
      nextSampleIndex: nextSampleIndex,
      supportsResume: true,
      allCompleted: annotatedCount === totalSamples && nextSampleId === null
    };
    
    console.log('🔄 [RESUME] Returning response:', response);
    res.json(response);
  } catch (error) {
    console.error('❌ [RESUME] Failed to get resume position:', error);
    res.status(500).json({ error: 'Failed to get resume position' });
  }
});

// Get a specific sample
router.get('/samples/:id', (req: Request, res: Response) => {
  try {
    const sample = configService.getSampleById(req.params.id);
    if (!sample) {
      res.status(404).json({ error: 'Sample not found' });
      return;
    }
    res.json(sample);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get sample' });
  }
});

// Get sample data (content URL)
router.get('/samples/:id/data', async (req: Request, res: Response) => {
  try {
    const sample = configService.getSampleById(req.params.id);
    if (!sample) {
      res.status(404).json({ error: 'Sample not found' });
      return;
    }
    
    // For demo mode without Azure, read from local files
    if (!process.env.STORAGE_CONN_STR) {
      // Return sample data based on type
      if (sample.type === 'image') {
        res.json({ 
          url: `/api/demo/image/${sample.id}`,
          type: sample.type 
        });
      } else if (sample.type === 'text') {
        res.json({ 
          content: `Sample text content for ${sample.fileName}`,
          type: sample.type 
        });
      } else if (sample.type === 'time-series') {
        // Try to read from local mock-data files or blob URLs
        try {
          const config = configService.getConfig();
          const fileContent = await localFileService.getSampleData(sample, config);
          
          // Check if content is CSV or JSON
          if (sample.fileName.endsWith('.csv') || fileContent.trim().startsWith('time,')) {
            // Parse CSV to time-series format
            const seriesCount = sample.metadata?.channelCount || 10;
            const timeSeries = CSVParser.parseCSVToTimeSeries(fileContent, seriesCount);
            res.json(timeSeries);
          } else {
            // Parse as JSON
            const parsed = JSON.parse(fileContent);
            res.json({
              seriesData: parsed.seriesData || parsed,
              type: sample.type
            });
          }
          return;
        } catch (fileError) {
          // Fall back to generated data if file doesn't exist
          const seriesCount = 10;
          const seriesData: number[][] = [];
          for (let i = 0; i < seriesCount; i++) {
            const series: number[] = [];
            for (let j = 0; j < 100; j++) {
              // Generate sinusoidal data with some noise for demo
              series.push(Math.sin(j * 0.1 + i * 0.5) * 0.5 + (Math.random() - 0.5) * 0.2);
            }
            seriesData.push(series);
          }
          res.json({
            seriesData,
            type: sample.type
          });
        }
      } else {
        res.json({ 
          url: `/api/demo/media/${sample.id}`,
          type: sample.type 
        });
      }
      return;
    }

    // For Azure mode, check if it's time-series
    if (sample.type === 'time-series') {
      try {
        // Use localFileService which handles both URLs and local paths
        const config = configService.getConfig();
        const content = await localFileService.getSampleData(sample, config);
        
        // Check if content is CSV or JSON
        if (sample.fileName.endsWith('.csv') || content.trim().startsWith('time,')) {
          // Parse CSV to time-series format
          const seriesCount = sample.metadata?.channelCount || 10;
          const timeSeries = CSVParser.parseCSVToTimeSeries(content, seriesCount);
          res.json(timeSeries);
        } else {
          // Parse as JSON
          const parsed = JSON.parse(content);
          res.json({ seriesData: parsed.seriesData ?? parsed, type: sample.type });
        }
      } catch (parseError) {
        res.status(400).json({ error: 'Invalid time-series data format. Expected valid JSON or CSV.' });
        return;
      }
    } else {
      const url = await storageService.getSampleUrl(sample);
      res.json({ url, type: sample.type });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to get sample data' });
  }
});

// Get annotation for a sample
router.get('/annotations/:sampleId', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    // Get user ID from Azure B2C session or fallback to demo user
    const userId = authReq.user?.userId ?? authReq.user?.azureObjectId ?? 'demo-user';
    
    // Check local storage first (for demo mode)
    if (!process.env.STORAGE_CONN_STR) {
      // Return null for demo mode - annotations stored in browser
      res.json(null);
      return;
    }

    const annotation = await storageService.getAnnotation(req.params.sampleId, userId);
    res.json(annotation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get annotation' });
  }
});

// Save annotation - syncs to Azure Blob Storage with user credential tracking
router.post('/annotations', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    // Get user information from Azure B2C session
    const userId = authReq.user?.userId ?? authReq.user?.azureObjectId ?? 'demo-user';
    const userEmail = authReq.user?.email;
    const userName = authReq.user?.name;
    const azureObjectId = authReq.user?.azureObjectId;
    const tenantId = authReq.user?.tenantId;
    
    console.log('📝 [ANNOTATION SAVE] Incoming annotation from user:', {
      userId,
      userName,
      userEmail,
      sampleId: req.body.sampleId,
      hasAuthUser: !!authReq.user,
      userFullInfo: authReq.user
    });
    
    const annotation: Annotation = {
      id: uuidv4(),
      sampleId: req.body.sampleId,
      userId: userId,
      userEmail: userEmail,
      userName: userName,
      timestamp: new Date().toISOString(),
      labels: req.body.labels,
      status: req.body.status ?? 'submitted',
      // Include Azure credential metadata for tracking who annotated what
      azureObjectId: azureObjectId,
      tenantId: tenantId
    };

    // Always attempt to sync to Azure Blob Storage using project.json config
    try {
      await storageService.saveAnnotation(annotation);
      console.log('✅ [ANNOTATION] Successfully persisted to Azure Blob Storage:', {
        annotationId: annotation.id,
        userId: annotation.userId,
        sampleId: annotation.sampleId
      });
      res.json({ success: true, annotation, syncedToAzure: true });
    } catch (azureError) {
      // If Azure persistence fails, still return the annotation but note it's not persisted
      console.warn('⚠️  [ANNOTATION] Failed to persist to Azure, will use browser localStorage:', {
        annotationId: annotation.id,
        userId: annotation.userId,
        error: (azureError as Error).message
      });
      res.json({ 
        success: true, 
        annotation, 
        syncedToAzure: false,
        warning: 'Annotation saved locally but not synced to Azure. Check server logs.'
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to save annotation' });
  }
});

// Get project statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    if (!process.env.STORAGE_CONN_STR) {
      const config = configService.getConfig();
      res.json({ 
        totalSamples: config.samples.length, 
        annotatedSamples: 0 
      });
      return;
    }

    const stats = await storageService.getProjectStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Get navigation info
router.get('/navigation/:sampleId', (req: Request, res: Response) => {
  try {
    const config = configService.getConfig();
    const currentIndex = config.samples.findIndex(s => s.id === req.params.sampleId);
    
    res.json({
      current: currentIndex + 1,
      total: config.samples.length,
      hasPrevious: currentIndex > 0,
      hasNext: currentIndex < config.samples.length - 1,
      previousId: currentIndex > 0 ? config.samples[currentIndex - 1]?.id : null,
      nextId: currentIndex < config.samples.length - 1 ? config.samples[currentIndex + 1]?.id : null
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get navigation info' });
  }
});

// List all annotations for a sample (for admin/review purposes)
// Shows which users have annotated each sample
router.get('/annotations/:sampleId/all', async (req: Request, res: Response) => {
  try {
    if (!process.env.STORAGE_CONN_STR) {
      res.json({ annotations: [], message: 'Azure storage not configured' });
      return;
    }

    const annotations = await storageService.listAnnotationsForSample(req.params.sampleId);
    // Return annotations with user tracking info
    res.json({
      sampleId: req.params.sampleId,
      totalAnnotations: annotations.length,
      annotations: annotations.map(a => ({
        id: a.id,
        userId: a.userId,
        userEmail: a.userEmail,
        userName: a.userName,
        azureObjectId: a.azureObjectId,
        tenantId: a.tenantId,
        timestamp: a.timestamp,
        status: a.status,
        labels: a.labels
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list annotations' });
  }
});

export default router;
