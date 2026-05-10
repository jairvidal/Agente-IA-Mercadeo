locals {
  name = "${var.name_prefix}-${var.env}"
}

# --- Buckets ---

resource "aws_s3_bucket" "backups" {
  bucket = "${local.name}-backups"

  tags = {
    Name    = "${local.name}-backups"
    Purpose = "pg-dump-backups"
  }
}

resource "aws_s3_bucket" "dashboard" {
  bucket = "${local.name}-dashboard"

  tags = {
    Name    = "${local.name}-dashboard"
    Purpose = "spa-static-assets"
  }
}

resource "aws_s3_bucket" "logs" {
  bucket = "${local.name}-logs"

  tags = {
    Name    = "${local.name}-logs"
    Purpose = "cloudfront-access-logs"
  }
}

# --- Block public access (all buckets) ---

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket                  = aws_s3_bucket.backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "dashboard" {
  bucket                  = aws_s3_bucket.dashboard.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket                  = aws_s3_bucket.logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# --- Versioning (dashboard only) ---

resource "aws_s3_bucket_versioning" "dashboard" {
  bucket = aws_s3_bucket.dashboard.id
  versioning_configuration {
    status = "Enabled"
  }
}

# --- Lifecycle policies ---

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "expire-backups-30d"
    status = "Enabled"
    filter {}
    expiration {
      days = 30
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    id     = "expire-logs-30d"
    status = "Enabled"
    filter {}
    expiration {
      days = 30
    }
  }
}
