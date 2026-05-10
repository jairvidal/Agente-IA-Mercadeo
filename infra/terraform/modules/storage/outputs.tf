output "backups_bucket_id" {
  description = "S3 bucket ID for pg_dump backups"
  value       = aws_s3_bucket.backups.id
}

output "dashboard_bucket_id" {
  description = "S3 bucket ID for dashboard SPA static assets (used by frontend module)"
  value       = aws_s3_bucket.dashboard.id
}

output "dashboard_bucket_regional_domain" {
  description = "S3 bucket regional domain name for CloudFront origin access"
  value       = aws_s3_bucket.dashboard.bucket_regional_domain_name
}

output "logs_bucket_id" {
  description = "S3 bucket ID for CloudFront access logs"
  value       = aws_s3_bucket.logs.id
}
