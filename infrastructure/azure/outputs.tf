# -----------------------------------------------------------------------------
# Terraform Outputs for Simple Label Maker Azure Infrastructure
# -----------------------------------------------------------------------------
# These outputs provide useful information after deployment, including
# resource IDs, URLs, and configuration values needed for the application.
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# Resource Group Outputs
# -----------------------------------------------------------------------------

output "resource_group_name" {
  description = "Name of the created resource group"
  value       = azurerm_resource_group.main.name
}

output "resource_group_id" {
  description = "ID of the created resource group"
  value       = azurerm_resource_group.main.id
}

output "location" {
  description = "Azure region where resources are deployed"
  value       = azurerm_resource_group.main.location
}

# -----------------------------------------------------------------------------
# Storage Account Outputs
# -----------------------------------------------------------------------------

output "storage_account_name" {
  description = "Name of the storage account"
  value       = azurerm_storage_account.main.name
}

output "storage_account_id" {
  description = "ID of the storage account"
  value       = azurerm_storage_account.main.id
}

output "storage_container_name" {
  description = "Name of the blob container for labeling data"
  value       = azurerm_storage_container.main.name
}

output "storage_blob_endpoint" {
  description = "Blob endpoint URL for the storage account"
  value       = azurerm_storage_account.main.primary_blob_endpoint
}

# -----------------------------------------------------------------------------
# Container Registry Outputs
# -----------------------------------------------------------------------------

output "acr_name" {
  description = "Name of the Azure Container Registry"
  value       = azurerm_container_registry.main.name
}

output "acr_login_server" {
  description = "Login server URL for the Azure Container Registry"
  value       = azurerm_container_registry.main.login_server
}

output "acr_admin_username" {
  description = "Admin username for the Azure Container Registry"
  value       = azurerm_container_registry.main.admin_username
  sensitive   = true
}

output "acr_admin_password" {
  description = "Admin password for the Azure Container Registry"
  value       = azurerm_container_registry.main.admin_password
  sensitive   = true
}

# -----------------------------------------------------------------------------
# App Service Outputs
# -----------------------------------------------------------------------------

output "app_service_name" {
  description = "Name of the App Service"
  value       = azurerm_linux_web_app.main.name
}

output "app_service_url" {
  description = "Default URL of the deployed web application"
  value       = "https://${azurerm_linux_web_app.main.default_hostname}"
}

output "app_service_id" {
  description = "ID of the App Service"
  value       = azurerm_linux_web_app.main.id
}

# -----------------------------------------------------------------------------
# Managed Identity Outputs
# -----------------------------------------------------------------------------

output "managed_identity_name" {
  description = "Name of the User Assigned Managed Identity"
  value       = azurerm_user_assigned_identity.main.name
}

output "managed_identity_client_id" {
  description = "Client ID of the Managed Identity (used for DefaultAzureCredential)"
  value       = azurerm_user_assigned_identity.main.client_id
}

output "managed_identity_principal_id" {
  description = "Principal ID of the Managed Identity"
  value       = azurerm_user_assigned_identity.main.principal_id
}

# -----------------------------------------------------------------------------
# Configuration Helpers
# -----------------------------------------------------------------------------

output "project_json_azure_storage" {
  description = "Azure storage configuration block for project.json"
  value = {
    accountName     = azurerm_storage_account.main.name
    containerName   = azurerm_storage_container.main.name
    dataPath        = "samples"
    annotationsPath = "annotations"
  }
}

output "docker_push_commands" {
  description = "Commands to build and push the Docker image to ACR"
  value       = <<-EOT
    # Login to ACR
    az acr login --name ${azurerm_container_registry.main.name}

    # Build the image
    docker build -t ${azurerm_container_registry.main.login_server}/${var.docker_image_name}:${var.docker_image_tag} .

    # Push to ACR
    docker push ${azurerm_container_registry.main.login_server}/${var.docker_image_name}:${var.docker_image_tag}
  EOT
}
