# -----------------------------------------------------------------------------
# Terraform Variables for Simple Label Maker AWS Infrastructure
# -----------------------------------------------------------------------------
# These variables allow customization of the AWS resources.
# Most have sensible defaults, but region and naming should be reviewed.
#
# Mapping from Azure to AWS:
# - Azure Resource Group -> AWS uses tags for logical grouping
# - Azure Storage Account -> AWS S3 Bucket
# - Azure Container Registry -> AWS ECR
# - Azure App Service -> AWS ECS Fargate
# - Azure Managed Identity -> AWS IAM Task Role
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# General Configuration
# -----------------------------------------------------------------------------

variable "aws_region" {
  description = "AWS region for all resources (e.g., 'us-east-1', 'eu-west-1')"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used for resource naming and tagging"
  type        = string
  default     = "simple-label-maker"

  validation {
    condition     = can(regex("^[a-z0-9-]{3,50}$", var.project_name))
    error_message = "Project name must be 3-50 lowercase letters, numbers, and hyphens."
  }
}

variable "environment" {
  description = "Environment name (e.g., 'dev', 'staging', 'production')"
  type        = string
  default     = "production"
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
# S3 Storage Configuration (Maps to Azure Storage Account)
# -----------------------------------------------------------------------------

variable "s3_bucket_name" {
  description = "Name for the S3 bucket (must be globally unique). If empty, a name will be generated."
  type        = string
  default     = ""

  validation {
    condition     = var.s3_bucket_name == "" || can(regex("^[a-z0-9][a-z0-9-]*[a-z0-9]$", var.s3_bucket_name)) && length(var.s3_bucket_name) >= 3 && length(var.s3_bucket_name) <= 63
    error_message = "S3 bucket name must be 3-63 lowercase letters, numbers, and hyphens only."
  }
}

variable "s3_versioning_enabled" {
  description = "Enable versioning for the S3 bucket (recommended for data protection)"
  type        = bool
  default     = true
}

variable "s3_force_destroy" {
  description = "Allow Terraform to delete the bucket even if it contains objects (use with caution)"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# ECR Configuration (Maps to Azure Container Registry)
# -----------------------------------------------------------------------------

variable "ecr_repository_name" {
  description = "Name for the ECR repository"
  type        = string
  default     = "simple-label-maker"
}

variable "ecr_image_tag_mutability" {
  description = "Tag mutability setting for ECR (MUTABLE or IMMUTABLE)"
  type        = string
  default     = "MUTABLE"

  validation {
    condition     = contains(["MUTABLE", "IMMUTABLE"], var.ecr_image_tag_mutability)
    error_message = "ECR image tag mutability must be MUTABLE or IMMUTABLE."
  }
}

variable "ecr_scan_on_push" {
  description = "Enable image scanning on push to ECR"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# ECS Configuration (Maps to Azure App Service)
# -----------------------------------------------------------------------------

variable "ecs_cluster_name" {
  description = "Name for the ECS cluster"
  type        = string
  default     = "simple-label-maker-cluster"
}

variable "ecs_service_name" {
  description = "Name for the ECS service"
  type        = string
  default     = "simple-label-maker-service"
}

variable "ecs_task_cpu" {
  description = "CPU units for the ECS task (256, 512, 1024, 2048, 4096)"
  type        = number
  default     = 256

  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.ecs_task_cpu)
    error_message = "ECS task CPU must be 256, 512, 1024, 2048, or 4096."
  }
}

variable "ecs_task_memory" {
  description = "Memory (MiB) for the ECS task. Must be compatible with CPU setting."
  type        = number
  default     = 512

  validation {
    condition     = var.ecs_task_memory >= 512 && var.ecs_task_memory <= 30720
    error_message = "ECS task memory must be between 512 and 30720 MiB."
  }
}

variable "ecs_desired_count" {
  description = "Desired number of ECS tasks to run"
  type        = number
  default     = 1

  validation {
    condition     = var.ecs_desired_count >= 0
    error_message = "ECS desired count must be non-negative."
  }
}

variable "container_port" {
  description = "Port exposed by the container (Simple Label Maker uses 3000)"
  type        = number
  default     = 3000
}

variable "docker_image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

# -----------------------------------------------------------------------------
# Networking Configuration
# -----------------------------------------------------------------------------

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "availability_zones" {
  description = "Availability zones for the subnets. If empty, zones will be auto-selected."
  type        = list(string)
  default     = []
}

# -----------------------------------------------------------------------------
# Load Balancer Configuration
# -----------------------------------------------------------------------------

variable "enable_alb" {
  description = "Enable Application Load Balancer for the ECS service"
  type        = bool
  default     = true
}

variable "alb_internal" {
  description = "Whether the ALB should be internal (not internet-facing)"
  type        = bool
  default     = false
}

variable "health_check_path" {
  description = "Path for ALB health checks"
  type        = string
  default     = "/health"
}

variable "health_check_interval" {
  description = "Interval (seconds) between health checks"
  type        = number
  default     = 30
}
