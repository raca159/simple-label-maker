# -----------------------------------------------------------------------------
# Terraform Provider Configuration for AWS
# -----------------------------------------------------------------------------
# This file configures the AWS provider for creating and managing AWS resources.
# Authentication can be configured via environment variables, shared credentials,
# or IAM roles.
# -----------------------------------------------------------------------------

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.tags
  }
}
