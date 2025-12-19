import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { configService } from './services/configService';
import { storageService } from './services/azureStorage';
import apiRouter from './routes/api';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3000;

// Trust proxy - important for Azure Container Apps and other reverse proxies
// This allows Express to correctly read X-Forwarded-* headers
app.set('trust proxy', 1);

// ============================================
// EARLY MIDDLEWARE - Run before rate limiter
// ============================================

// Mock authentication for development mode
// Set MOCK_AUTH=true and MOCK_USER_ID=<user-id> in .env to enable
const mockAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.MOCK_AUTH !== 'true') {
    return next();
  }

  const mockUserId = process.env.MOCK_USER_ID || 'dev-user-001';
  const mockEmail = process.env.MOCK_USER_EMAIL || `${mockUserId}@dev.local`;
  const mockName = process.env.MOCK_USER_NAME || mockUserId;

  console.log('🧪 [MOCK AUTH] Setting mock user:', {
    userId: mockUserId,
    email: mockEmail,
    name: mockName
  });

  (req as any).user = {
    userId: mockUserId,
    name: mockName,
    email: mockEmail,
    identityProvider: 'mock',
    roles: [],
    azureObjectId: mockUserId,
    isMockAuth: true
  };

  next();
};

app.use(mockAuthMiddleware);

// Middleware to extract user info from Azure B2C headers (set by Container App Easy Auth)
// This MUST run before rate limiting
app.use((req: Request, res: Response, next: NextFunction) => {
  // Skip if already authenticated via mock auth
  if ((req as any).user?.isMockAuth) {
    return next();
  }

  const clientPrincipalHeader = req.header('X-MS-CLIENT-PRINCIPAL');
  const clientPrincipalName = req.header('X-MS-CLIENT-PRINCIPAL-NAME');
  const clientPrincipalId = req.header('X-MS-CLIENT-PRINCIPAL-ID');
  const clientPrincipalIdp = req.header('X-MS-CLIENT-PRINCIPAL-IDP');

  // Log all headers for debugging
  if (process.env.DEBUG_HEADERS === 'true') {
    console.log('\n📨 [DEBUG] All request headers:');
    Object.entries(req.headers).forEach(([key, value]) => {
      if (key.toLowerCase().includes('client') || key.toLowerCase().includes('auth') || key.toLowerCase().includes('cookie')) {
        console.log(`   ${key}: ${typeof value === 'string' && value.length > 100 ? value.substring(0, 100) + '...' : value}`);
      }
    });
  }

  console.log('\n📋 [AUTH MIDDLEWARE] Checking for authentication headers...');
  console.log('   Headers present:', {
    'X-MS-CLIENT-PRINCIPAL': !!clientPrincipalHeader,
    'X-MS-CLIENT-PRINCIPAL-NAME': clientPrincipalName ? `✓ (${clientPrincipalName})` : '✗',
    'X-MS-CLIENT-PRINCIPAL-ID': clientPrincipalId ? `✓ (${clientPrincipalId})` : '✗',
    'X-MS-CLIENT-PRINCIPAL-IDP': clientPrincipalIdp ? `✓ (${clientPrincipalIdp})` : '✗'
  });

  let principalData: Record<string, any> = {};
  let hasFullPrincipal = false;

  // Try to decode the full principal header first
  if (clientPrincipalHeader) {
    try {
      const decoded = Buffer.from(clientPrincipalHeader, 'base64').toString('utf-8');
      principalData = JSON.parse(decoded) as Record<string, any>;
      
      // Check if it has actual content (not just empty object)
      if (principalData.userId || principalData.userDetails || principalData.identityProvider) {
        hasFullPrincipal = true;
        console.log('✅ [AUTH] Full X-MS-CLIENT-PRINCIPAL decoded with content');
      } else {
        console.log('⚠️  [AUTH] X-MS-CLIENT-PRINCIPAL is empty, will use fallback headers');
      }
    } catch (error) {
      console.log('⚠️  [AUTH] Failed to decode X-MS-CLIENT-PRINCIPAL, will use fallback headers');
    }
  }

  // Use simple headers as the primary source (Azure B2C often only provides these)
  if (clientPrincipalName || clientPrincipalId) {
    console.log('✅ [AUTH] Using Azure B2C headers (recommended for B2C)');

    (req as any).user = {
      userId: clientPrincipalId || 'unknown',
      name: clientPrincipalName,
      email: clientPrincipalName, // Email is typically the name for B2C
      identityProvider: clientPrincipalIdp || 'aad',
      roles: [],
      azureObjectId: clientPrincipalId
    };

    console.log('✅ [AUTH] User authenticated:', {
      userId: (req as any).user.userId,
      email: (req as any).user.email,
      name: (req as any).user.name,
      provider: (req as any).user.identityProvider
    });
  } else if (hasFullPrincipal) {
    // Fallback to full principal data if available
    const claims = principalData.claims || [];
    const nameClaimValue = claims.find((c: any) => c.typ === 'name')?.val || principalData.userDetails;
    const subClaimValue = claims.find((c: any) => c.typ === 'sub')?.val;
    const oidClaimValue = claims.find((c: any) => c.typ === 'oid')?.val;
    const emailClaimValue = claims.find((c: any) => c.typ === 'emails')?.val || principalData.userDetails;

    (req as any).user = {
      userId: subClaimValue || oidClaimValue || principalData.userId,
      name: nameClaimValue,
      email: emailClaimValue,
      azureObjectId: oidClaimValue,
      sub: subClaimValue,
      identityProvider: principalData.identityProvider,
      roles: principalData.userRoles || [],
      fullPrincipal: principalData
    };

    console.log('✅ [AUTH] User authenticated (from full principal):', {
      userId: (req as any).user.userId,
      email: (req as any).user.email,
      name: (req as any).user.name,
      provider: (req as any).user.identityProvider
    });
  } else {
    console.log('⚠️  [AUTH] No authentication headers found - using demo mode');
  }

  next();
});

// ============================================
// RATE LIMITING & STANDARD MIDDLEWARE
// ============================================

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

    // Always try to initialize Azure Storage
    // Will use DefaultAzureCredential (managed identity) or fall back to STORAGE_CONN_STR env var
    try {
      await storageService.initialize(config);
      console.log('✅ Azure Storage initialized successfully');
    } catch (error) {
      console.warn('⚠️  Azure Storage initialization failed:', (error as Error).message);
      console.log('   Running in demo mode (annotations will be stored locally)');
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
