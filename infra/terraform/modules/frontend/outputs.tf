output "distribution_id" {
  description = "CloudFront distribution ID (needed for cache invalidation in deploy-dashboard.yml)"
  value       = aws_cloudfront_distribution.dashboard.id
}

output "distribution_domain" {
  description = "CloudFront distribution domain name (e.g. xxxxx.cloudfront.net) — CNAME target for the dashboard FQDN"
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

output "acm_certificate_arn" {
  description = "ARN of the ACM certificate for the dashboard FQDN (null until dashboard_fqdn is set)"
  value       = length(aws_acm_certificate.dashboard) > 0 ? aws_acm_certificate.dashboard[0].arn : null
}

output "acm_validation_records" {
  description = "DNS validation records to give SIDOC. List of { name, type, value } — they create CNAMEs from name → value."
  value = length(aws_acm_certificate.dashboard) > 0 ? [
    for r in aws_acm_certificate.dashboard[0].domain_validation_options : {
      name  = r.resource_record_name
      type  = r.resource_record_type
      value = r.resource_record_value
    }
  ] : []
}

output "acm_certificate_status" {
  description = "ACM cert status — PENDING_VALIDATION until SIDOC adds the CNAME, then ISSUED."
  value       = length(aws_acm_certificate.dashboard) > 0 ? aws_acm_certificate.dashboard[0].status : null
}
