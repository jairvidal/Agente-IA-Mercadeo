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

variable "dashboard_fqdn" {
  description = "FQDN of the dashboard SPA (e.g. marketing.stg.sidocsa.com). Required to create ACM cert; aliases attached only when dashboard_dns_enabled = true."
  type        = string
  default     = null
}

variable "dashboard_dns_enabled" {
  description = "When true, waits for ACM cert validation and attaches the FQDN as a CloudFront alias. Set true only after SIDOC adds the validation CNAME."
  type        = bool
  default     = false
}
