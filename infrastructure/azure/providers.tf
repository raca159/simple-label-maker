# -----------------------------------------------------------------------------
# Terraform Provider Configuration for Azure
# -----------------------------------------------------------------------------
# This file configures the Azure Resource Manager (azurerm) provider.
# The provider is required to create and manage Azure resources.
# -----------------------------------------------------------------------------

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}
