# Simple Label Maker - AWS Infrastructure (Terraform)

This Terraform module provisions the essential AWS infrastructure required to run the Simple Label Maker web application using ECS Fargate.

## Overview

This module creates a complete AWS deployment environment with minimal configuration, enabling users to deploy the web application with a single `terraform apply`. It mirrors the architecture and functionality of the Azure deployment while using AWS-native services.

## Azure to AWS Resource Mapping

| Azure Resource | AWS Equivalent | Purpose |
|----------------|----------------|---------|
| Resource Group | Tags (logical grouping) | Organize and manage resources |
| Storage Account + Blob Container | S3 Bucket | Store samples and annotations |
| Azure Container Registry (ACR) | Amazon ECR | Store Docker container images |
| App Service + App Service Plan | ECS Fargate + ALB | Run containerized application |
| User Assigned Managed Identity | IAM Task Role | Secure credential-free access |
| Storage Blob Data Contributor Role | IAM S3 Access Policy | Grant storage permissions |
| Azure AD B2C | Amazon Cognito | User authentication (reference only) |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              AWS Account                                 │
│                                                                          │
│  ┌────────────────────┐         ┌────────────────────┐                  │
│  │     S3 Bucket       │         │       ECR          │                  │
│  │   - samples/        │         │  Container         │                  │
│  │   - annotations/    │         │  Registry          │                  │
│  └─────────┬──────────┘         └─────────┬──────────┘                  │
│            │                              │                              │
│            │  IAM Policy:                 │  Pull Image                  │
│            │  s3:GetObject                │                              │
│            │  s3:PutObject                │                              │
│            │  s3:ListBucket               │                              │
│            │                              │                              │
│            ▼                              ▼                              │
│  ┌─────────────────────────────────────────────────────┐                │
│  │              IAM Task Role                          │                │
│  └─────────────────────────────────────────────────────┘                │
│                            │                                             │
│                            │ Assigned to                                 │
│                            ▼                                             │
│  ┌─────────────────────────────────────────────────────┐                │
│  │                    VPC                               │                │
│  │  ┌─────────────────────────────────────────────┐    │                │
│  │  │     Application Load Balancer (ALB)         │    │                │
│  │  │     - HTTP Listener (port 80)               │    │                │
│  │  └─────────────────────┬───────────────────────┘    │                │
│  │                        │                             │                │
│  │  ┌─────────────────────▼───────────────────────┐    │                │
│  │  │          ECS Fargate Cluster                │    │                │
│  │  │  ┌─────────────────────────────────────┐    │    │                │
│  │  │  │   Simple Label Maker Container       │    │    │                │
│  │  │  │   (pulled from ECR)                  │    │    │                │
│  │  │  │   Port: 3000                         │    │    │                │
│  │  │  └─────────────────────────────────────┘    │    │                │
│  │  └─────────────────────────────────────────────┘    │                │
│  │                                                      │                │
│  │  ┌────────────────┐    ┌────────────────┐           │                │
│  │  │ Public Subnet 1 │    │ Public Subnet 2 │           │                │
│  │  │ (AZ 1)          │    │ (AZ 2)          │           │                │
│  │  └────────────────┘    └────────────────┘           │                │
│  └─────────────────────────────────────────────────────┘                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Resources Created

| Resource | Purpose |
|----------|---------|
| **S3 Bucket** | Storage for sample assets and annotation data (replaces Azure Blob Storage) |
| **ECR Repository** | Private Docker registry for container images (replaces Azure ACR) |
| **VPC** | Virtual Private Cloud with public subnets for networking |
| **Internet Gateway** | Enables internet access for the VPC |
| **Security Groups** | Network access control for ALB and ECS tasks |
| **ECS Cluster** | Managed container orchestration cluster |
| **ECS Service** | Runs and maintains the desired count of tasks |
| **ECS Task Definition** | Defines the container configuration |
| **Application Load Balancer** | Distributes traffic to ECS tasks |
| **IAM Roles** | Task execution role and task role for S3 access |
| **CloudWatch Log Group** | Centralized logging for ECS containers |

## Prerequisites

1. **AWS CLI** installed and configured (`aws configure`)
2. **Terraform** >= 1.0.0 installed
3. **Docker** installed (for building and pushing container images)
4. **AWS Account** with permissions to create resources (IAM, ECS, ECR, S3, VPC, etc.)

## Quick Start

### 1. Initialize Terraform

```bash
cd infrastructure/aws
terraform init
```

### 2. Review and Customize Variables

Create a `terraform.tfvars` file to customize the deployment:

```hcl
# terraform.tfvars
aws_region     = "us-east-1"
project_name   = "my-label-maker"
environment    = "production"

# S3 bucket name (must be globally unique, leave empty for auto-generation)
s3_bucket_name = "my-labelmaker-data"

# ECR repository name
ecr_repository_name = "my-label-maker"

# ECS configuration
ecs_task_cpu    = 256   # vCPU units
ecs_task_memory = 512   # MiB
ecs_desired_count = 1

tags = {
  Project     = "my-labeling-project"
  Environment = "production"
  Owner       = "your-name"
}
```

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
# Get ECR repository URL from Terraform output
ECR_URL=$(terraform output -raw ecr_repository_url)
AWS_REGION=$(terraform output -raw aws_region)

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URL

# Build the image (from repository root)
cd ../..
docker build -t $ECR_URL:latest .

# Push to ECR
docker push $ECR_URL:latest
```

### 5. Upload Sample Data

Upload your labeling samples to the S3 bucket:

```bash
S3_BUCKET=$(terraform output -raw s3_bucket_name)

# Upload sample files
aws s3 sync ./your-samples-folder s3://$S3_BUCKET/samples/
```

### 6. Configure project.json

Update your `config/project.json` with the AWS storage configuration:

```json
{
  "projectId": "my-project",
  "projectName": "My Labeling Project",
  "awsStorage": {
    "bucketName": "<s3_bucket_name from terraform output>",
    "region": "us-east-1",
    "dataPath": "samples",
    "annotationsPath": "annotations"
  }
}
```

> **Note:** The application will need an AWS storage service implementation similar to `azureStorage.ts`. See the [AWS Integration](#aws-integration) section.

### 7. Access Your Application

```bash
# Get the application URL
terraform output application_url
```

## Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `aws_region` | AWS region | `us-east-1` |
| `project_name` | Project name for resource naming | `simple-label-maker` |
| `environment` | Environment name | `production` |
| `s3_bucket_name` | S3 bucket name (globally unique) | Auto-generated |
| `s3_versioning_enabled` | Enable S3 versioning | `true` |
| `s3_force_destroy` | Allow bucket deletion with objects | `false` |
| `ecr_repository_name` | ECR repository name | `simple-label-maker` |
| `ecr_image_tag_mutability` | ECR tag mutability | `MUTABLE` |
| `ecr_scan_on_push` | Enable ECR vulnerability scanning | `true` |
| `ecs_cluster_name` | ECS cluster name | `simple-label-maker-cluster` |
| `ecs_service_name` | ECS service name | `simple-label-maker-service` |
| `ecs_task_cpu` | Task CPU units (256-4096) | `256` |
| `ecs_task_memory` | Task memory MiB (512-30720) | `512` |
| `ecs_desired_count` | Number of tasks to run | `1` |
| `container_port` | Container port | `3000` |
| `docker_image_tag` | Docker image tag | `latest` |
| `vpc_cidr` | VPC CIDR block | `10.0.0.0/16` |
| `public_subnet_cidrs` | Public subnet CIDRs | `["10.0.1.0/24", "10.0.2.0/24"]` |
| `enable_alb` | Enable Application Load Balancer | `true` |
| `alb_internal` | Make ALB internal only | `false` |
| `health_check_path` | Health check endpoint | `/health` |
| `tags` | Resource tags | See variables.tf |

## Outputs Reference

| Output | Description |
|--------|-------------|
| `aws_region` | AWS region where resources are deployed |
| `s3_bucket_name` | S3 bucket name for labeling data |
| `s3_bucket_arn` | ARN of the S3 bucket |
| `ecr_repository_url` | ECR repository URL for docker commands |
| `ecs_cluster_name` | ECS cluster name |
| `ecs_service_name` | ECS service name |
| `application_url` | URL of the deployed application |
| `alb_dns_name` | DNS name of the load balancer |
| `ecs_task_role_arn` | ARN of the task IAM role (for S3 access) |
| `docker_push_commands` | Helper commands for pushing images |
| `project_json_aws_storage` | Ready-to-use awsStorage config block |

## AWS Cognito Authentication

> **Note:** Amazon Cognito is **not** provisioned by this Terraform module.

Cognito can be used as an alternative to Azure AD B2C for user authentication:

1. **Create a Cognito User Pool** in the AWS Console
2. **Create an App Client** for the web application
3. **Configure hosted UI** or custom authentication flows
4. **Update `config/project.json`** with Cognito configuration:

```json
{
  "authentication": {
    "cognito": {
      "userPoolId": "us-east-1_XXXXXXXX",
      "clientId": "your-app-client-id",
      "region": "us-east-1",
      "domain": "your-domain.auth.us-east-1.amazoncognito.com",
      "redirectUri": "http://your-app-url/auth/callback",
      "scopes": ["openid", "profile", "email"]
    }
  }
}
```

### Mapping User Attributes to Annotations

When using Cognito, map the following user attributes for annotation tracking:

| Cognito Attribute | Annotation Field | Purpose |
|-------------------|------------------|---------|
| `sub` | `userId` | Unique user identifier |
| `email` | `userEmail` | User email address |
| `name` | `userName` | Display name |
| `custom:tenant_id` | `tenantId` | Multi-tenant scenarios |

## AWS Integration

To use AWS S3 instead of Azure Blob Storage, create an AWS storage service:

```typescript
// src/services/awsStorage.ts
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Annotation, ProjectConfig, SampleInfo } from '../types';

export class AwsStorageService {
  private s3Client: S3Client | null = null;
  private config: ProjectConfig | null = null;
  private bucketName: string | null = null;

  async initialize(config: ProjectConfig): Promise<void> {
    this.config = config;
    
    // Use environment variables or IAM role credentials (ECS Task Role)
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION ?? 'us-east-1'
    });
    
    this.bucketName = process.env.S3_BUCKET_NAME;
  }

  async saveAnnotation(annotation: Annotation): Promise<void> {
    if (!this.s3Client || !this.config || !this.bucketName) {
      throw new Error('Storage service not initialized');
    }

    const key = `${this.config.awsStorage.annotationsPath}/${annotation.sampleId}_${annotation.userId}.json`;
    
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: JSON.stringify(annotation, null, 2),
      ContentType: 'application/json'
    }));
  }

  // Additional methods for getSampleData, getSampleUrl, getAnnotation, etc.
}

export const storageService = new AwsStorageService();
```

## Security Considerations

### IAM Task Role

This module uses an **IAM Task Role** for secure AWS resource access:

- ECS tasks use the task role to access S3 automatically
- No access keys or secrets are embedded in the application
- S3 access is granted via IAM policy with least-privilege permissions
- ECR image pulling uses the task execution role

### IAM Policies

| Role | Resource | Permissions | Purpose |
|------|----------|-------------|---------|
| Task Execution Role | ECR, CloudWatch | Pull images, write logs | ECS infrastructure |
| Task Role | S3 Bucket | GetObject, PutObject, ListBucket, DeleteObject | Application data access |

### Secrets Management

- No credentials are stored in environment variables (IAM roles are used)
- For additional secrets, consider using AWS Secrets Manager or Parameter Store
- Never commit `terraform.tfstate` files containing sensitive outputs

### Network Security

- ALB security group allows only HTTP/HTTPS inbound
- ECS security group allows only traffic from ALB
- Consider adding WAF for additional protection in production

## Optional Enhancements

### HTTPS with ACM

Add SSL/TLS using AWS Certificate Manager:

```hcl
resource "aws_acm_certificate" "main" {
  domain_name       = "labelmaker.example.com"
  validation_method = "DNS"
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main[0].arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.main.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main[0].arn
  }
}
```

### Auto Scaling

Add auto-scaling for the ECS service:

```hcl
resource "aws_appautoscaling_target" "ecs" {
  max_capacity       = 4
  min_capacity       = 1
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.main.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}
```

### Private Subnets with NAT Gateway

For enhanced security, use private subnets for ECS tasks:

```hcl
resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = local.availability_zones[count.index]
}
```

### AWS Secrets Manager

For managing application secrets:

```hcl
resource "aws_secretsmanager_secret" "app_secrets" {
  name = "${var.project_name}-secrets"
}
```

## Cleanup

To destroy all created resources:

```bash
terraform destroy
```

> **Warning:** This will delete all resources including any data stored in the S3 bucket (if `force_destroy = true`).

## Troubleshooting

### Container Fails to Start

1. Check ECS service events: 
   ```bash
   aws ecs describe-services --cluster <cluster-name> --services <service-name>
   ```
2. Check CloudWatch logs:
   ```bash
   aws logs tail /ecs/simple-label-maker --follow
   ```
3. Verify the container image exists in ECR
4. Check that the image was pushed with the correct tag

### S3 Access Denied

1. Verify the IAM task role has the correct S3 policy attached
2. Check that `S3_BUCKET_NAME` environment variable is set in the task definition
3. Ensure the bucket name in the application matches the Terraform output

### ECR Authentication Issues

1. Verify ECR login is successful:
   ```bash
   aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com
   ```
2. Check that the task execution role has ECR permissions
3. Verify the ECR repository exists and contains the expected image tag

### Health Check Failures

1. Verify the application starts correctly locally
2. Check that the health endpoint returns 200:
   ```bash
   curl http://localhost:3000/health
   ```
3. Review CloudWatch logs for application errors
4. Ensure the security group allows traffic on port 3000

### Network Connectivity Issues

1. Verify the VPC has an internet gateway attached
2. Check that public subnets have `map_public_ip_on_launch = true`
3. Verify route tables have a route to the internet gateway
4. Check security group rules allow outbound traffic

## Cost Considerations

| Resource | Approximate Monthly Cost (us-east-1) |
|----------|--------------------------------------|
| ECS Fargate (256 CPU, 512 MB) | ~$10-15 |
| Application Load Balancer | ~$16-20 |
| S3 Storage (1GB) | < $1 |
| ECR Storage (1GB) | < $1 |
| NAT Gateway (if added) | ~$30-35 |
| CloudWatch Logs (1GB) | < $1 |

> Use the [AWS Pricing Calculator](https://calculator.aws/) for accurate estimates based on your usage.

## License

Apache License 2.0 - see [LICENSE](../../LICENSE) for details.
