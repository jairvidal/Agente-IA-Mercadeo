variable "env" {
  description = "Deployment environment"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS region — us-east-1 for best latency from Colombia"
  type        = string
  default     = "us-east-1"
}

variable "name_prefix" {
  description = "Prefix for all resource names"
  type        = string
  default     = "sidoc-ai-marketing"
}

variable "domain_name" {
  description = "Root domain for TLS and DNS. Null until SIDOC confirms subdomain delegation."
  type        = string
  default     = null
}

variable "alert_email" {
  description = "Email address for CloudWatch alarm notifications"
  type        = string
  default     = null
}

variable "langfuse_host" {
  description = "Langfuse host. Set per-environment in tfvars. Pending SIDOC Habeas Data sign-off for prod."
  type        = string
  default     = "https://cloud.langfuse.com"
}
