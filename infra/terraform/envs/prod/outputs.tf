# SKELETON — outputs are commented until modules are uncommented in main.tf

# output "ec2_public_ip" {
#   description = "Elastic IP of the EC2 instance"
#   value       = module.compute.public_ip
# }

# output "ecr_repos_urls" {
#   description = "ECR repository URLs (map: repo_name => url)"
#   value       = module.registry.repository_urls
# }

# output "dashboard_cloudfront_domain" {
#   description = "CloudFront distribution domain for the dashboard SPA"
#   value       = module.frontend.distribution_domain
# }

# output "dashboard_bucket" {
#   description = "S3 bucket name for dashboard static assets"
#   value       = module.storage.dashboard_bucket_id
# }

# output "runtime_secret_arn" {
#   description = "ARN of the Secrets Manager secret for runtime config"
#   value       = module.secrets.secret_arn
# }

# output "github_actions_role_arn" {
#   description = "IAM role ARN for GitHub Actions OIDC"
#   value       = module.github_oidc.role_arn
# }
