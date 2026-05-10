output "repository_urls" {
  description = "ECR repository URLs (map: repo_name => url)"
  value       = { for k, v in aws_ecr_repository.repos : k => v.repository_url }
}

output "repository_arns" {
  description = "ECR repository ARNs (used by github-oidc module for push permissions)"
  value       = { for k, v in aws_ecr_repository.repos : k => v.arn }
}
