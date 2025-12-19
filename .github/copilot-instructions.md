# Copilot Instructions for Simple Label Maker

This document provides guidance for GitHub Copilot when working with the Simple Label Maker repository.

## Project Overview

Simple Label Maker is a containerized data labeling solution built with TypeScript and Express.js. It is designed to run on Azure with Azure B2C authentication and Azure Blob Storage integration.

## Technology Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript (strict mode enabled)
- **Framework**: Express.js 5.x
- **Storage**: Azure Blob Storage (`@azure/storage-blob`)
- **Authentication**: Azure AD B2C (`@azure/identity`)
- **XML Parsing**: xml2js for UI schema parsing
- **Build Tool**: TypeScript Compiler (tsc)
- **Development**: nodemon with ts-node for hot reloading

## Project Structure

```
src/
├── index.ts           # Express server entry point
├── routes/
│   └── api.ts         # REST API endpoints
├── services/
│   ├── azureStorage.ts    # Azure Blob Storage integration
│   ├── configService.ts   # Configuration management
│   └── uiSchemaParser.ts  # UI.xml parser
└── types/
    └── index.ts       # TypeScript type definitions

public/                # Frontend static assets
├── index.html
├── css/
└── js/

config/                # Configuration files
├── project.json       # Project configuration
└── UI.xml             # Labeling interface schema
```

## Coding Conventions

### TypeScript

- Use strict TypeScript with all strict mode checks enabled
- Define interfaces for all data structures in `src/types/index.ts`
- Use explicit return types for functions
- Prefer `const` over `let` where possible
- Use nullish coalescing (`??`) instead of `||` for default values
- Use optional chaining (`?.`) for safe property access

### Express Routes

- Use the `Router` class for modular route definitions
- Handle errors with try-catch blocks in route handlers
- Return appropriate HTTP status codes (200, 400, 404, 500)
- Use TypeScript types for Request and Response objects
- Create extended request interfaces when adding custom properties (e.g., `AuthenticatedRequest`)

### Service Classes

- Export singleton instances (e.g., `export const configService = new ConfigService()`)
- Use async/await for asynchronous operations
- Add JSDoc comments for public methods
- Throw descriptive errors that can be caught by route handlers

### Naming Conventions

- Use camelCase for variables and functions
- Use PascalCase for interfaces, types, and classes
- Use descriptive names that reflect purpose
- Prefix interface properties with appropriate types (e.g., `userId`, `sampleId`)

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `STORAGE_CONN_STR` | Azure Blob Storage connection string |
| `CONFIG_PATH` | Custom path to project.json |
| `UI_XML_PATH` | Custom path to UI.xml |

### Project Configuration (project.json)

The project configuration defines:
- Project metadata (ID, name, description)
- Azure Storage settings (account, container, paths)
- Azure B2C authentication settings
- Sample definitions (ID, filename, type, metadata)

### UI Schema (UI.xml)

The UI schema defines the labeling interface using XML:
- Data source type (image, text, audio, video, time-series)
- Label configurations (classification, rating, text-input, time-series)
- Layout options (columns, progress bar, instructions)

## Common Development Tasks

### Running the Development Server

```bash
npm install
npm run dev
```

### Building for Production

```bash
npm run build
npm start
```

### Docker Deployment

```bash
docker-compose up --build
```

## API Patterns

All API endpoints are prefixed with `/api` and follow RESTful conventions:

- `GET /api/project` - Get project information
- `GET /api/samples` - List all samples
- `GET /api/samples/:id` - Get specific sample
- `GET /api/annotations/:sampleId` - Get annotation for current user
- `POST /api/annotations` - Save annotation

## Supported Data Types

| Type | Description |
|------|-------------|
| `image` | Image files (jpg, png, etc.) |
| `text` | Text documents |
| `audio` | Audio files |
| `video` | Video files |
| `time-series` | Multi-timeseries data (JSON arrays) |

## Testing

Currently, the project uses a placeholder test script. When adding tests:
- Place test files alongside source files or in a `__tests__` directory
- Use descriptive test names
- Mock Azure services for unit tests

## Security Considerations

- Rate limiting is enabled for all requests
- Azure B2C is used for authentication in production
- Connection strings and secrets should be stored in environment variables
- Never commit `.env` files or sensitive configuration
