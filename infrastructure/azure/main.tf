# -----------------------------------------------------------------------------
# Terraform Main Configuration for Simple Label Maker Azure Infrastructure
# -----------------------------------------------------------------------------
# This file provisions all required Azure resources for running the
# Simple Label Maker web application using Azure App Service.
#
# Resources Created:
# 1. Resource Group - Logical grouping for all resources
# 2. Storage Account & Blob Container - Stores samples and annotations
# 3. Azure Container Registry (ACR) - Stores Docker container images
# 4. App Service Plan - Defines compute resources for the web app
# 5. App Service (Linux) - Hosts the containerized web application
# 6. User Assigned Managed Identity - Enables secure Azure resource access
# 7. Role Assignment - Grants storage access to the managed identity
#
# Authentication Note:
# Azure AD B2C is NOT provisioned by Terraform. Users must configure B2C
# separately and reference it in config/project.json. See README.md.
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# Resource Group
# -----------------------------------------------------------------------------
# Logical container for all Azure resources. Makes it easy to manage,
# monitor, and delete all resources as a unit.
# -----------------------------------------------------------------------------

resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
  tags     = var.tags
}

# -----------------------------------------------------------------------------
# User Assigned Managed Identity
# -----------------------------------------------------------------------------
# A managed identity allows the App Service to securely access Azure resources
# (like Storage) without embedding secrets or connection strings in code.
# This identity will be assigned to the App Service and granted permissions.
# -----------------------------------------------------------------------------

resource "azurerm_user_assigned_identity" "main" {
  name                = var.managed_identity_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = var.tags
}

# -----------------------------------------------------------------------------
# Storage Account
# -----------------------------------------------------------------------------
# Azure Blob Storage for:
# - Sample assets (images, audio, text, video, time-series data)
# - Annotation data (JSON files saved per sample/user)
# - Project configuration files (UI.xml, project.json) if stored externally
#
# The storage account uses the DefaultAzureCredential pattern, which
# automatically uses the Managed Identity when running in Azure.
# -----------------------------------------------------------------------------

resource "azurerm_storage_account" "main" {
  name                     = var.storage_account_name
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = var.storage_replication_type
  account_kind             = "StorageV2"

  # Enable blob versioning for data protection (optional but recommended)
  blob_properties {
    versioning_enabled = true
  }

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Blob Container
# -----------------------------------------------------------------------------
# Container to hold all labeling project data. Structure:
# - samples/     - Raw data files to be labeled
# - annotations/ - JSON annotation files ({sampleId}_{userId}.json)
# -----------------------------------------------------------------------------

resource "azurerm_storage_container" "main" {
  name                  = var.storage_container_name
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}

# -----------------------------------------------------------------------------
# Role Assignment: Storage Blob Data Contributor
# -----------------------------------------------------------------------------
# Grants the Managed Identity read/write access to blobs in the storage
# account. This follows the principle of least privilege - the identity
# can only access blob data, not manage the storage account itself.
#
# This eliminates the need for connection strings or storage keys.
# The application uses DefaultAzureCredential to authenticate automatically.
# -----------------------------------------------------------------------------

resource "azurerm_role_assignment" "storage_blob_contributor" {
  scope                = azurerm_storage_account.main.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.main.principal_id
}

# -----------------------------------------------------------------------------
# Azure Container Registry (ACR)
# -----------------------------------------------------------------------------
# Private container registry to store and pull Docker images for deployment.
# The App Service will pull images from this registry.
#
# If you prefer a public registry (e.g., Docker Hub, GitHub Container Registry),
# you can skip this resource and configure the App Service accordingly.
# -----------------------------------------------------------------------------

resource "azurerm_container_registry" "main" {
  name                = var.acr_name
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = var.acr_sku
  admin_enabled       = var.acr_admin_enabled

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Role Assignment: ACR Pull
# -----------------------------------------------------------------------------
# Grants the Managed Identity permission to pull images from ACR.
# This allows the App Service to deploy containers without storing
# registry credentials.
# -----------------------------------------------------------------------------

resource "azurerm_role_assignment" "acr_pull" {
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.main.principal_id
}

# -----------------------------------------------------------------------------
# App Service Plan (Linux)
# -----------------------------------------------------------------------------
# Defines the compute resources for the web application.
# Using Linux for container support. The SKU determines pricing/performance.
#
# SKU Options:
# - B1/B2/B3: Basic tier, good for dev/test
# - S1/S2/S3: Standard tier, production workloads
# - P1v2/P2v2/P3v2: Premium tier, high performance
# -----------------------------------------------------------------------------

resource "azurerm_service_plan" "main" {
  name                = var.app_service_plan_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  os_type             = "Linux"
  sku_name            = var.app_service_sku

  tags = var.tags
}

# -----------------------------------------------------------------------------
# App Service (Linux Web App for Containers)
# -----------------------------------------------------------------------------
# Hosts and runs the Simple Label Maker Docker container.
# Configured to:
# - Pull images from ACR using Managed Identity
# - Use Managed Identity for Azure resource access (Storage)
# - Expose port 3000 (the app's default port)
#
# The app uses DefaultAzureCredential which automatically detects and uses
# the assigned Managed Identity when running in Azure.
# -----------------------------------------------------------------------------

resource "azurerm_linux_web_app" "main" {
  name                = var.app_service_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  service_plan_id     = azurerm_service_plan.main.id

  # Assign the Managed Identity to the App Service
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.main.id]
  }

  site_config {
    # Configure container settings
    application_stack {
      docker_registry_url      = "https://${azurerm_container_registry.main.login_server}"
      docker_image_name        = "${var.docker_image_name}:${var.docker_image_tag}"
      docker_registry_username = azurerm_container_registry.main.admin_username
      docker_registry_password = azurerm_container_registry.main.admin_password
    }

    # Health check endpoint for container
    health_check_path = "/health"

    # Always on keeps the app warm (recommended for production)
    always_on = true
  }

  app_settings = {
    # Application configuration
    "WEBSITES_PORT"                       = "3000"
    "NODE_ENV"                            = "production"
    "WEBSITES_ENABLE_APP_SERVICE_STORAGE" = "false"

    # Azure Storage configuration (using Managed Identity, no connection string needed)
    # The app's DefaultAzureCredential will use the assigned identity
    "AZURE_CLIENT_ID" = azurerm_user_assigned_identity.main.client_id

    # Docker/ACR configuration
    "DOCKER_REGISTRY_SERVER_URL"      = "https://${azurerm_container_registry.main.login_server}"
    "DOCKER_REGISTRY_SERVER_USERNAME" = azurerm_container_registry.main.admin_username
    "DOCKER_REGISTRY_SERVER_PASSWORD" = azurerm_container_registry.main.admin_password
  }

  tags = var.tags

  # Ensure role assignments are created before the app tries to access resources
  depends_on = [
    azurerm_role_assignment.storage_blob_contributor,
    azurerm_role_assignment.acr_pull
  ]
}
