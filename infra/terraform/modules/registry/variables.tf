variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "env" {
  description = "Deployment environment"
  type        = string
}

variable "repos" {
  description = "List of ECR repository names to create. Dashboard excluded."
  type        = list(string)
  default     = ["backend", "mcp-server"]
}
