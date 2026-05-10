output "distribution_id" {
  description = "CloudFront distribution ID (needed for cache invalidation in deploy-dashboard.yml)"
  value       = aws_cloudfront_distribution.dashboard.id
}

output "distribution_domain" {
  description = "CloudFront distribution domain name (e.g. xxxxx.cloudfront.net)"
  value       = aws_cloudfront_distribution.dashboard.domain_name
}

output "distribution_arn" {
  description = "CloudFront distribution ARN (used by github-oidc for scoped invalidation permission)"
  value       = aws_cloudfront_distribution.dashboard.arn
}

output "oac_id" {
  description = "CloudFront Origin Access Control ID"
  value       = aws_cloudfront_origin_access_control.dashboard.id
}
