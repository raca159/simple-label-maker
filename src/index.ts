import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { configService } from './services/configService';
import { storageService } from './services/azureStorage';
import apiRouter from './routes/api';

const app = express();
const PORT = process.env.PORT ?? 3000;

// Rate limiting for security
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// CORS for development
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// API routes
app.use('/api', apiRouter);

// Demo image endpoint (for development without Azure)
app.get('/api/demo/image/:id', (req: Request, res: Response) => {
  // Generate a simple placeholder SVG
  const id = req.params.id;
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
  const color = colors[parseInt(id.replace(/\D/g, '')) % colors.length] ?? '#4ECDC4';
  
  const svg = `
    <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${color}"/>
      <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="48" fill="white" text-anchor="middle">
        Sample Image
      </text>
      <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle">
        ${id}
      </text>
    </svg>
  `;
  
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svg);
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Serve the main labeling interface
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Serve labeling page for specific sample
app.get('/label/:sampleId', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Initialize and start server
async function startServer() {
  try {
    // Load configuration
    const configPath = process.env.CONFIG_PATH ?? path.join(__dirname, '../config/project.json');
    const uiXmlPath = process.env.UI_XML_PATH ?? path.join(__dirname, '../config/UI.xml');
    
    // Create default config files if they don't exist
    if (!fs.existsSync(configPath)) {
      console.log('Creating default project configuration...');
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      configService.createDefaultConfig(configPath);
    }
    
    if (!fs.existsSync(uiXmlPath)) {
      console.log('Creating default UI.xml...');
      fs.mkdirSync(path.dirname(uiXmlPath), { recursive: true });
      configService.createDefaultUIXml(uiXmlPath);
    }

    // Load configurations
    const config = await configService.loadConfig(configPath);
    const uiSchema = await configService.loadUISchema(uiXmlPath);
    
    console.log(`Loaded project: ${config.projectName}`);
    console.log(`UI Schema: ${uiSchema.labelingInterface.title}`);
    console.log(`Total samples: ${config.samples.length}`);

    // Initialize Azure Storage if connection string is provided
    if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
      await storageService.initialize(config);
      console.log('Azure Storage initialized');
    } else {
      console.log('Running in demo mode (no Azure Storage connection)');
    }

    // Start the server
    app.listen(PORT, () => {
      console.log(`\n🏷️  Simple Label Maker is running!`);
      console.log(`   Local:   http://localhost:${PORT}`);
      console.log(`   Health:  http://localhost:${PORT}/health`);
      console.log(`\n   Press Ctrl+C to stop\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
