variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "env" {
  description = "Deployment environment"
  type        = string
}

variable "alert_email" {
  description = "Email for CloudWatch alarm SNS notifications. Null disables email subscription."
  type        = string
  default     = null
}
