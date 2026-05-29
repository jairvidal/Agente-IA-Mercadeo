locals {
  name = "${var.name_prefix}-${var.env}"

  # CloudFront aliases + ACM attachment only kick in once the cert is validated.
  attach_custom_domain = var.dashboard_dns_enabled && var.dashboard_fqdn != null
}

# ACM certificate for the dashboard FQDN. CloudFront requires the cert in us-east-1.
# Created in PENDING_VALIDATION state on first apply — SIDOC adds the validation
# CNAME (see output `acm_validation_record`), then dashboard_dns_enabled flips true.
resource "aws_acm_certificate" "dashboard" {
  count = var.dashboard_fqdn != null ? 1 : 0

  domain_name       = var.dashboard_fqdn
  validation_method = "DNS"

  tags = {
    Name = "${local.name}-acm-dashboard"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_acm_certificate_validation" "dashboard" {
  count = local.attach_custom_domain ? 1 : 0

  certificate_arn         = aws_acm_certificate.dashboard[0].arn
  validation_record_fqdns = [for r in aws_acm_certificate.dashboard[0].domain_validation_options : r.resource_record_name]
}

resource "aws_cloudfront_origin_access_control" "dashboard" {
  name                              = "${local.name}-oac-dashboard"
  description                       = "OAC for ${local.name} dashboard S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "dashboard" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "${local.name} dashboard SPA"

  origin {
    domain_name              = var.dashboard_bucket_regional_domain
    origin_id                = "s3-dashboard"
    origin_access_control_id = aws_cloudfront_origin_access_control.dashboard.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-dashboard"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  # SPA fallback: S3 403/404 → serve /index.html so TanStack Router handles client-side routing
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = !local.attach_custom_domain
    acm_certificate_arn            = local.attach_custom_domain ? aws_acm_certificate_validation.dashboard[0].certificate_arn : null
    ssl_support_method             = local.attach_custom_domain ? "sni-only" : null
    minimum_protocol_version       = local.attach_custom_domain ? "TLSv1.2_2021" : null
  }

  aliases = local.attach_custom_domain ? [var.dashboard_fqdn] : []

  tags = {
    Name = "${local.name}-cloudfront-dashboard"
  }
}

# S3 bucket policy: allow CloudFront OAC to read objects
resource "aws_s3_bucket_policy" "dashboard" {
  bucket = var.dashboard_bucket_id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontOAC"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "arn:aws:s3:::${var.dashboard_bucket_id}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.dashboard.arn
        }
      }
    }]
  })
}
