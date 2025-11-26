# Simple Label Maker - Azure Infrastructure (Terraform)

This Terraform module provisions the essential Azure infrastructure required to run the Simple Label Maker web application using Azure App Service.

## Overview

This module creates a complete Azure deployment environment with minimal configuration, enabling users to deploy the web application with a single `terraform apply`.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Azure Resource Group                         │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │  Storage Account │    │ Container       │                     │
│  │  - Blob Container│    │ Registry (ACR)  │                     │
│  │    - samples/    │    │                 │                     │
│  │    - annotations/│    │                 │                     │
│  └────────┬────────┘    └────────┬────────┘                     │
│           │                      │                               │
│           │  Role: Storage       │  Role: AcrPull               │
│           │  Blob Data           │                               │
│           │  Contributor         │                               │
│           │                      │                               │
│           ▼                      ▼                               │
│  ┌─────────────────────────────────────────┐                    │
│  │       User Assigned Managed Identity     │                    │
│  └─────────────────────────────────────────┘                    │
│                          │                                       │
│                          │ Assigned to                           │
│                          ▼                                       │
│  ┌─────────────────────────────────────────┐                    │
│  │            App Service (Linux)           │                    │
│  │  ┌─────────────────────────────────┐    │                    │
│  │  │   Simple Label Maker Container   │    │                    │
│  │  │   (pulled from ACR)              │    │                    │
│  │  └─────────────────────────────────┘    │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Resources Created

| Resource | Purpose |
|----------|---------|
| **Resource Group** | Logical grouping for all resources; enables easy management and cleanup |
| **Storage Account** | Azure Blob Storage for sample assets and annotation data |
| **Blob Container** | Container within storage for `samples/` and `annotations/` |
| **Container Registry (ACR)** | Private Docker registry for container images |
| **App Service Plan** | Linux compute resources for the web application |
| **App Service** | Hosts the containerized Simple Label Maker application |
| **User Assigned Managed Identity** | Enables secure, credential-free access to Azure resources |
| **Role Assignments** | Grants least-privilege permissions to storage and ACR |

## Prerequisites

1. **Azure CLI** installed and authenticated (`az login`)
2. **Terraform** >= 1.0.0 installed
3. **Docker** installed (for building and pushing container images)
4. **Azure Subscription** with permissions to create resources

## Quick Start

### 1. Initialize Terraform

```bash
cd infrastructure/azure
terraform init
```

### 2. Review and Customize Variables

Create a `terraform.tfvars` file to customize the deployment:

```hcl
# terraform.tfvars
location             = "eastus"
resource_group_name  = "rg-my-label-maker"
storage_account_name = "stmylabelmaker"  # Must be globally unique
acr_name             = "acrmylabelmaker"  # Must be globally unique
app_service_name     = "app-my-label-maker"  # Must be globally unique

tags = {
  Project     = "my-labeling-project"
  Environment = "production"
  Owner       = "your-name"
}
```

> **Important:** Storage account names must be globally unique, 3-24 lowercase letters and numbers only. ACR names must be 5-50 alphanumeric characters.

### 3. Deploy Infrastructure

```bash
# Preview changes
terraform plan

# Apply changes
terraform apply
```

### 4. Build and Push Container Image

After infrastructure is deployed, build and push your Docker image:

```bash
# Get ACR login server from Terraform output
ACR_LOGIN_SERVER=$(terraform output -raw acr_login_server)
ACR_NAME=$(terraform output -raw acr_name)

# Login to ACR
az acr login --name $ACR_NAME

# Build the image (from repository root)
cd ../..
docker build -t $ACR_LOGIN_SERVER/simple-label-maker:latest .

# Push to ACR
docker push $ACR_LOGIN_SERVER/simple-label-maker:latest
```

### 5. Upload Sample Data

Upload your labeling samples to the blob container:

```bash
STORAGE_ACCOUNT=$(terraform output -raw storage_account_name)
CONTAINER_NAME=$(terraform output -raw storage_container_name)

# Upload sample files
az storage blob upload-batch \
  --account-name $STORAGE_ACCOUNT \
  --destination $CONTAINER_NAME/samples \
  --source ./your-samples-folder \
  --auth-mode login
```

### 6. Configure project.json

Update your `config/project.json` with the storage account details:

```json
{
  "projectId": "my-project",
  "projectName": "My Labeling Project",
  "azureStorage": {
    "accountName": "<storage_account_name from terraform output>",
    "containerName": "labeling-data",
    "dataPath": "samples",
    "annotationsPath": "annotations"
  }
}
```

### 7. Access Your Application

```bash
# Get the application URL
terraform output app_service_url
```

## Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `location` | Azure region | `eastus` |
| `resource_group_name` | Resource group name | `rg-simple-label-maker` |
| `storage_account_name` | Storage account name (globally unique) | `stlabelmaker` |
| `storage_container_name` | Blob container name | `labeling-data` |
| `storage_replication_type` | Storage redundancy (LRS, GRS, etc.) | `LRS` |
| `acr_name` | Container registry name (globally unique) | `acrlabelmaker` |
| `acr_sku` | ACR tier (Basic, Standard, Premium) | `Basic` |
| `acr_admin_enabled` | Enable ACR admin user (not recommended) | `false` |
| `app_service_plan_name` | App Service Plan name | `asp-simple-label-maker` |
| `app_service_sku` | App Service tier (B1, S1, P1v2, etc.) | `B1` |
| `app_service_name` | App Service name (globally unique) | `app-simple-label-maker` |
| `docker_image_name` | Docker image name | `simple-label-maker` |
| `docker_image_tag` | Docker image tag | `latest` |
| `managed_identity_name` | Managed Identity name | `id-simple-label-maker` |
| `tags` | Resource tags | See variables.tf |

## Outputs Reference

| Output | Description |
|--------|-------------|
| `resource_group_name` | Created resource group name |
| `storage_account_name` | Storage account name |
| `storage_blob_endpoint` | Blob storage endpoint URL |
| `acr_login_server` | ACR login server for docker commands |
| `app_service_url` | Application URL |
| `managed_identity_client_id` | Client ID for DefaultAzureCredential |
| `docker_push_commands` | Helper commands for pushing images |
| `project_json_azure_storage` | Ready-to-use azureStorage config block |

## Azure B2C Authentication

> **Note:** Azure AD B2C is **not** provisioned by this Terraform module.

Azure B2C requires manual setup due to its complexity and tenant-specific configuration:

1. **Create an Azure AD B2C Tenant** in the Azure Portal
2. **Register your application** in the B2C tenant
3. **Create user flows** (sign-up/sign-in)
4. **Update `config/project.json`** with B2C configuration:

```json
{
  "authentication": {
    "azureB2C": {
      "tenantId": "your-b2c-tenant-id",
      "clientId": "your-app-client-id",
      "authority": "https://your-tenant.b2clogin.com/your-tenant.onmicrosoft.com/B2C_1_signupsignin",
      "redirectUri": "https://your-app-url/auth/callback",
      "scopes": ["openid", "profile", "email"]
    }
  }
}
```

For detailed B2C setup instructions, see the [Azure AD B2C documentation](https://docs.microsoft.com/azure/active-directory-b2c/).

## Security Considerations

### Managed Identity

This module uses a **User Assigned Managed Identity** for secure Azure resource access:

- The App Service uses `DefaultAzureCredential` to automatically authenticate
- No connection strings or secrets are embedded in the application
- Storage access is granted via RBAC with least-privilege permissions
- ACR image pulling uses Managed Identity (no admin credentials required)

### Role Assignments

| Identity | Resource | Role | Purpose |
|----------|----------|------|---------|
| Managed Identity | Storage Account | Storage Blob Data Contributor | Read/write blob data |
| Managed Identity | Container Registry | AcrPull | Pull container images |

### Secrets Management

- No ACR credentials are stored in app settings (Managed Identity is used)
- For enhanced security, consider using Azure Key Vault for any additional secrets
- Never commit `terraform.tfstate` files containing sensitive outputs

## Optional Enhancements

### Key Vault Integration

For secrets management beyond infrastructure configuration, add Azure Key Vault:

```hcl
resource "azurerm_key_vault" "main" {
  name                = "kv-label-maker"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"
}
```

### Application Insights

For monitoring and logging, add Application Insights:

```hcl
resource "azurerm_application_insights" "main" {
  name                = "ai-label-maker"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  application_type    = "web"
}
```

### Private Networking

For enhanced security, configure VNet integration and private endpoints (not included in base module).

## Cleanup

To destroy all created resources:

```bash
terraform destroy
```

> **Warning:** This will delete all resources including any data stored in the blob container.

## Troubleshooting

### Container Fails to Start

1. Check App Service logs: `az webapp log tail --name <app-name> --resource-group <rg-name>`
2. Verify the container image exists in ACR
3. Check that the image was pushed with the correct tag

### Storage Access Denied

1. Verify the managed identity role assignment is complete
2. Check that `AZURE_CLIENT_ID` app setting matches the managed identity
3. Ensure the container name in project.json matches the Terraform output

### ACR Authentication Issues

1. Verify the Managed Identity has the AcrPull role on the ACR
2. Check that App Service can reach the ACR endpoint
3. Ensure `container_registry_use_managed_identity` is enabled in site_config
4. Verify the Managed Identity client ID is correctly configured

## License

Apache License 2.0 - see [LICENSE](../../LICENSE) for details.
