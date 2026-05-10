output "ecr_repository_urls" {
  description = "ECR repository URLs (map: repo_name => url)"
  value       = module.registry.repository_urls
}

output "runtime_secret_arn" {
  description = "ARN of the Secrets Manager runtime secret"
  value       = module.secrets.secret_arn
}

output "runtime_secret_name" {
  description = "Name of the Secrets Manager runtime secret (use with aws secretsmanager put-secret-value)"
  value       = module.secrets.secret_name
}

output "dashboard_cloudfront_domain" {
  description = "CloudFront distribution domain for the dashboard SPA (use until custom domain is set)"
  value       = module.frontend.distribution_domain
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (used in deploy-dashboard.yml for cache invalidation)"
  value       = module.frontend.distribution_id
}

output "dashboard_bucket" {
  description = "S3 bucket name for dashboard static assets"
  value       = module.storage.dashboard_bucket_id
}

output "ec2_instance_profile_arn" {
  description = "IAM instance profile ARN (attached to EC2 in E-00.4)"
  value       = module.compute.instance_profile_arn
}

output "vpc_id" {
  description = "VPC ID"
  value       = module.network.vpc_id
}

output "public_subnet_id" {
  description = "Public subnet ID for EC2 placement in E-00.4"
  value       = module.network.public_subnet_ids[0]
}

output "sg_ec2_id" {
  description = "EC2 security group ID"
  value       = module.network.sg_ec2_id
}

# Uncomment in E-00.4 when EC2 is launched
# output "ec2_public_ip" {
#   description = "Elastic IP of the EC2 instance (use for sslip.io domain: {ip}.sslip.io)"
#   value       = module.compute.public_ip
# }

# Uncomment in E-00.5 when GitHub OIDC is configured
# output "github_actions_role_arn" {
#   description = "IAM role ARN for GitHub Actions OIDC"
#   value       = module.github_oidc.role_arn
# }
