variable "env" {
  description = "Deployment environment"
  type        = string
  default     = "staging"
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
  description = "Root domain for TLS and DNS (e.g. ai.sidoc.com.co). Null until SIDOC confirms subdomain delegation."
  type        = string
  default     = null
}

variable "alert_email" {
  description = "Email address for CloudWatch alarm notifications"
  type        = string
  default     = null
}

variable "langfuse_host" {
  description = "Langfuse host — Cloud by default. Override to http://langfuse:3030 for self-hosted."
  type        = string
  default     = "https://cloud.langfuse.com"
}
