# -----------------------------------------------------------------------------
# Terraform Variables for Simple Label Maker Azure Infrastructure
# -----------------------------------------------------------------------------
# These variables allow customization of the Azure resources.
# Most have sensible defaults, but location and naming should be reviewed.
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# General Configuration
# -----------------------------------------------------------------------------

variable "location" {
  description = "Azure region for all resources (e.g., 'eastus', 'westeurope')"
  type        = string
  default     = "eastus"
}

variable "resource_group_name" {
  description = "Name of the Azure Resource Group to create"
  type        = string
  default     = "rg-simple-label-maker"
}

variable "tags" {
  description = "Tags to apply to all resources for organization and billing"
  type        = map(string)
  default = {
    Project     = "simple-label-maker"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

# -----------------------------------------------------------------------------
# Storage Account Configuration
# -----------------------------------------------------------------------------

variable "storage_account_name" {
  description = "Name for the Azure Storage Account (must be globally unique, 3-24 lowercase letters/numbers)"
  type        = string
  default     = "stlabelmaker"

  validation {
    condition     = can(regex("^[a-z0-9]{3,24}$", var.storage_account_name))
    error_message = "Storage account name must be 3-24 lowercase letters and numbers only."
  }
}

variable "storage_container_name" {
  description = "Name of the blob container for storing samples and annotations"
  type        = string
  default     = "labeling-data"
}

variable "storage_replication_type" {
  description = "Replication type for the storage account (LRS, GRS, RAGRS, ZRS)"
  type        = string
  default     = "LRS"
}

# -----------------------------------------------------------------------------
# Container Registry Configuration
# -----------------------------------------------------------------------------

variable "acr_name" {
  description = "Name for the Azure Container Registry (must be globally unique, alphanumeric)"
  type        = string
  default     = "acrlabelmaker"

  validation {
    condition     = can(regex("^[a-zA-Z0-9]{5,50}$", var.acr_name))
    error_message = "ACR name must be 5-50 alphanumeric characters."
  }
}

variable "acr_sku" {
  description = "SKU for the Azure Container Registry (Basic, Standard, Premium)"
  type        = string
  default     = "Basic"
}

variable "acr_admin_enabled" {
  description = "Enable admin user for ACR (not recommended, use Managed Identity instead)"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# App Service Configuration
# -----------------------------------------------------------------------------

variable "app_service_plan_name" {
  description = "Name for the App Service Plan"
  type        = string
  default     = "asp-simple-label-maker"
}

variable "app_service_sku" {
  description = "SKU for the App Service Plan (B1, B2, S1, P1v2, etc.)"
  type        = string
  default     = "B1"
}

variable "app_service_name" {
  description = "Name for the App Service (must be globally unique)"
  type        = string
  default     = "app-simple-label-maker"
}

variable "docker_image_name" {
  description = "Docker image name (without registry prefix). Will be pulled from ACR."
  type        = string
  default     = "simple-label-maker"
}

variable "docker_image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

# -----------------------------------------------------------------------------
# Managed Identity Configuration
# -----------------------------------------------------------------------------

variable "managed_identity_name" {
  description = "Name for the User Assigned Managed Identity"
  type        = string
  default     = "id-simple-label-maker"
}
