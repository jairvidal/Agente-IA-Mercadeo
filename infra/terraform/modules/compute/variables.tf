variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "env" {
  description = "Deployment environment"
  type        = string
}

variable "secret_arn" {
  description = "ARN of the Secrets Manager secret for runtime config"
  type        = string
}

# Variables below are used by EC2 resources (E-00.4) — null-safe for E-00.3 IAM-only apply

variable "vpc_id" {
  description = "VPC ID from network module (required in E-00.4)"
  type        = string
  default     = null
}

variable "subnet_id" {
  description = "Public subnet ID for EC2 placement (required in E-00.4)"
  type        = string
  default     = null
}

variable "sg_id" {
  description = "Security group ID for the EC2 instance (required in E-00.4)"
  type        = string
  default     = null
}

variable "instance_type" {
  description = "EC2 instance type — t4g.small (2 vCPU, 2 GB ARM64 Graviton)"
  type        = string
  default     = "t4g.small"
}

variable "ami_id" {
  description = "AMI ID — Ubuntu 22.04 LTS ARM64 us-east-1. Set in E-00.4 (verify latest AMI before applying)."
  type        = string
  default     = null
}
