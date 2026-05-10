variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "env" {
  description = "Deployment environment"
  type        = string
}

# NOTE: no runtime_config variable here by design.
# Secret values are populated manually via AWS CLI after terraform apply:
#   aws secretsmanager put-secret-value \
#     --secret-id /sidoc-ai-marketing/{env}/runtime \
#     --secret-string file://runtime.json
# This ensures secrets never end up in Terraform state.
