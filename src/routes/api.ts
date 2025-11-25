import { Router, Request, Response } from 'express';
import { configService } from '../services/configService';
import { storageService } from '../services/azureStorage';
import { Annotation } from '../types';
import { v4 as uuidv4 } from 'uuid';

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
    
    // For demo mode without Azure, return a placeholder
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
      } else {
        res.json({ 
          url: `/api/demo/media/${sample.id}`,
          type: sample.type 
        });
      }
      return;
    }

    const url = await storageService.getSampleUrl(sample);
    res.json({ url, type: sample.type });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get sample data' });
  }
});

// Get annotation for a sample
router.get('/annotations/:sampleId', async (req: Request, res: Response) => {
  try {
    // For demo, use a fixed user ID
    const userId = (req as Request & { user?: { userId: string } }).user?.userId ?? 'demo-user';
    
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

// Save annotation
router.post('/annotations', async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { user?: { userId: string } }).user?.userId ?? 'demo-user';
    
    const annotation: Annotation = {
      id: uuidv4(),
      sampleId: req.body.sampleId,
      userId: userId,
      timestamp: new Date().toISOString(),
      labels: req.body.labels,
      status: req.body.status ?? 'submitted'
    };

    // For demo mode, just return success
    if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
      res.json({ success: true, annotation });
      return;
    }

    await storageService.saveAnnotation(annotation);
    res.json({ success: true, annotation });
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

export default router;
