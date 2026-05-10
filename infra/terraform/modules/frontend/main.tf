locals {
  name                = "${var.name_prefix}-${var.env}"
  dashboard_subdomain = "dashboard.${var.env}"
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
    cloudfront_default_certificate = var.acm_cert_arn == null
    acm_certificate_arn            = var.acm_cert_arn
    ssl_support_method             = var.acm_cert_arn != null ? "sni-only" : null
    minimum_protocol_version       = var.acm_cert_arn != null ? "TLSv1.2_2021" : null
  }

  # aliases populated only after domain + ACM cert are confirmed
  aliases = var.domain_name != null && var.acm_cert_arn != null ? ["${local.dashboard_subdomain}.${var.domain_name}"] : []

  tags = {
    Name = "${local.name}-cloudfront-dashboard"
  }
}

# S3 bucket policy: allow CloudFront OAC to read objects
resource "aws_s3_bucket_policy" "dashboard" {
  bucket = var.dashboard_bucket_id

  # depends on public access block in storage module being applied first;
  # Terraform resolves this via module dependency ordering
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

# Route53 record — uncomment when SIDOC confirms domain and zone is in Route53
# resource "aws_route53_record" "dashboard" {
#   count   = var.domain_name != null ? 1 : 0
#   zone_id = data.aws_route53_zone.main[0].zone_id
#   name    = "${local.dashboard_subdomain}.${var.domain_name}"
#   type    = "A"
#   alias {
#     name                   = aws_cloudfront_distribution.dashboard.domain_name
#     zone_id                = aws_cloudfront_distribution.dashboard.hosted_zone_id
#     evaluate_target_health = false
#   }
# }
# data "aws_route53_zone" "main" {
#   count = var.domain_name != null ? 1 : 0
#   name  = var.domain_name
# }
