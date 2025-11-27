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

// Get project information
router.get('/project', (req: Request, res: Response) => {
  try {
    const config = configService.getConfig();
    res.json({
      projectId: config.projectId,
      projectName: config.projectName,
      description: config.description,
      totalSamples: config.samples.length
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
    if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
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
        const data = await storageService.getSampleData(sample);
        const content = data.toString('utf-8');
        
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
    if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
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

    // For demo mode, just return success (stored in browser localStorage)
    if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
      res.json({ success: true, annotation, syncedToAzure: false });
      return;
    }

    // Sync annotation to Azure Blob Storage
    await storageService.saveAnnotation(annotation);
    res.json({ success: true, annotation, syncedToAzure: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save annotation' });
  }
});

// Get project statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
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
    if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
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
