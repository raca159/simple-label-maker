# -----------------------------------------------------------------------------
# Terraform Outputs for Simple Label Maker AWS Infrastructure
# -----------------------------------------------------------------------------
# These outputs provide useful information after deployment, including
# resource IDs, URLs, and configuration values needed for the application.
#
# Mapping from Azure outputs:
# - Azure Resource Group -> (AWS uses tags, no direct equivalent)
# - Azure Storage Account -> AWS S3 Bucket
# - Azure Container Registry -> AWS ECR
# - Azure App Service URL -> AWS ALB DNS Name
# - Azure Managed Identity -> AWS IAM Task Role
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# General Outputs
# -----------------------------------------------------------------------------

output "aws_region" {
  description = "AWS region where resources are deployed"
  value       = var.aws_region
}

output "account_id" {
  description = "AWS account ID"
  value       = data.aws_caller_identity.current.account_id
}

# -----------------------------------------------------------------------------
# S3 Bucket Outputs (Maps to Azure Storage Account)
# -----------------------------------------------------------------------------

output "s3_bucket_name" {
  description = "Name of the S3 bucket for labeling data"
  value       = aws_s3_bucket.main.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.main.arn
}

output "s3_bucket_regional_domain_name" {
  description = "Regional domain name of the S3 bucket"
  value       = aws_s3_bucket.main.bucket_regional_domain_name
}

# -----------------------------------------------------------------------------
# ECR Repository Outputs (Maps to Azure Container Registry)
# -----------------------------------------------------------------------------

output "ecr_repository_name" {
  description = "Name of the ECR repository"
  value       = aws_ecr_repository.main.name
}

output "ecr_repository_url" {
  description = "URL of the ECR repository for docker push commands"
  value       = aws_ecr_repository.main.repository_url
}

output "ecr_repository_arn" {
  description = "ARN of the ECR repository"
  value       = aws_ecr_repository.main.arn
}

# -----------------------------------------------------------------------------
# ECS Outputs (Maps to Azure App Service)
# -----------------------------------------------------------------------------

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = aws_ecs_cluster.main.arn
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.main.name
}

output "ecs_task_definition_arn" {
  description = "ARN of the ECS task definition"
  value       = aws_ecs_task_definition.main.arn
}

# -----------------------------------------------------------------------------
# Load Balancer Outputs (Maps to Azure App Service URL)
# -----------------------------------------------------------------------------

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = var.enable_alb ? aws_lb.main[0].dns_name : null
}

output "application_url" {
  description = "URL of the deployed web application"
  value       = var.enable_alb ? "http://${aws_lb.main[0].dns_name}" : null
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = var.enable_alb ? aws_lb.main[0].arn : null
}

# -----------------------------------------------------------------------------
# IAM Outputs (Maps to Azure Managed Identity)
# -----------------------------------------------------------------------------

output "ecs_task_role_name" {
  description = "Name of the ECS task IAM role (used for S3 access)"
  value       = aws_iam_role.ecs_task.name
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task IAM role"
  value       = aws_iam_role.ecs_task.arn
}

output "ecs_execution_role_name" {
  description = "Name of the ECS task execution role"
  value       = aws_iam_role.ecs_task_execution.name
}

output "ecs_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = aws_iam_role.ecs_task_execution.arn
}

# -----------------------------------------------------------------------------
# Networking Outputs
# -----------------------------------------------------------------------------

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "ecs_security_group_id" {
  description = "ID of the ECS security group"
  value       = aws_security_group.ecs.id
}

# -----------------------------------------------------------------------------
# Configuration Helpers (Maps to Azure project_json_azure_storage)
# -----------------------------------------------------------------------------

output "project_json_aws_storage" {
  description = "AWS storage configuration block for project.json (equivalent to Azure azureStorage)"
  value = {
    bucketName      = aws_s3_bucket.main.id
    region          = var.aws_region
    dataPath        = "samples"
    annotationsPath = "annotations"
  }
}

output "docker_push_commands" {
  description = "Commands to build and push the Docker image to ECR"
  value       = <<-EOT
    # Login to ECR
    aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${aws_ecr_repository.main.repository_url}

    # Build the image
    docker build -t ${aws_ecr_repository.main.repository_url}:${var.docker_image_tag} .

    # Push to ECR
    docker push ${aws_ecr_repository.main.repository_url}:${var.docker_image_tag}
  EOT
}

output "upload_samples_command" {
  description = "Command to upload sample files to S3"
  value       = <<-EOT
    # Upload sample files to S3
    aws s3 sync ./your-samples-folder s3://${aws_s3_bucket.main.id}/samples/
  EOT
}

# -----------------------------------------------------------------------------
# CloudWatch Logs Output
# -----------------------------------------------------------------------------

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group for ECS logs"
  value       = aws_cloudwatch_log_group.ecs.name
}

output "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.ecs.arn
}
