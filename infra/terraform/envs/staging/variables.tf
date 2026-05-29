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

variable "dashboard_fqdn" {
  description = "FQDN of the dashboard SPA (e.g. marketing.stg.sidocsa.com). Used for ACM cert + CloudFront alias."
  type        = string
  default     = null
}

variable "api_fqdn" {
  description = "FQDN of the backend API (e.g. api.marketing.stg.sidocsa.com). Used for Caddy auto-TLS + CORS whitelist."
  type        = string
  default     = null
}

variable "dashboard_dns_enabled" {
  description = "Set true once SIDOC adds the ACM validation CNAME. Triggers cert validation wait + CloudFront alias attach."
  type        = bool
  default     = false
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
