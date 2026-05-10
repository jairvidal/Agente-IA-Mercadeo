variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "env" {
  description = "Deployment environment"
  type        = string
}

variable "github_org" {
  description = "GitHub organization name"
  type        = string
  default     = "morphux"
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "Agente-IA-Mercadeo"
}

variable "allowed_branches" {
  description = "Branches allowed to assume the IAM role via OIDC"
  type        = list(string)
  default     = ["main"]
}
