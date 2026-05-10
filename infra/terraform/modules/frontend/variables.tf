variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "env" {
  description = "Deployment environment"
  type        = string
}

variable "dashboard_bucket_id" {
  description = "S3 bucket ID from storage module"
  type        = string
}

variable "dashboard_bucket_regional_domain" {
  description = "S3 bucket regional domain name for CloudFront origin"
  type        = string
}

variable "domain_name" {
  description = "Root domain for TLS (e.g. ai.sidoc.com.co). Null until SIDOC confirms delegation."
  type        = string
  default     = null
}

variable "acm_cert_arn" {
  description = "ACM certificate ARN in us-east-1 (REQUIRED for CloudFront). Null during initial deploy."
  type        = string
  default     = null
}
