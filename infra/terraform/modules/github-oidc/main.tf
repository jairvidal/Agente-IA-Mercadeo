# SKELETON — to be implemented in E-00.3/E-00.5.
# Resources are commented out so `terraform init` and `terraform plan` succeed
# without provisioning anything. Each TODO maps to a checkbox in sprint-1-prd.md.
#
# Pattern: GitHub Actions OIDC federation — no long-lived AWS credentials.
# Role assumed by: repo:morphux/Agente-IA-Mercadeo:ref:refs/heads/main

locals {
  name                     = "${var.name_prefix}-${var.env}"
  github_oidc_provider_url = "https://token.actions.githubusercontent.com"
  # GitHub OIDC thumbprint (stable, published by GitHub)
  github_oidc_thumbprint = "6938fd4d98bab03faadb97b34396831e3780aea1"
}

/*
TODO E-00.5: GitHub OIDC Identity Provider (shared across envs — create only once)
resource "aws_iam_openid_connect_provider" "github" {
  url             = local.github_oidc_provider_url
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [local.github_oidc_thumbprint]

  tags = { Name = "github-actions-oidc" }
}

TODO E-00.5: IAM role for GitHub Actions
resource "aws_iam_role" "github_actions" {
  name = "${local.name}-github-actions-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      for branch in var.allowed_branches : {
        Effect    = "Allow"
        Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
        Action    = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/${var.github_repo}:ref:refs/heads/${branch}"
          }
        }
      }
    ]
  })

  tags = { Name = "${local.name}-github-actions-role" }
}

TODO E-00.5: IAM policies for GitHub Actions role

ECR push (backend + mcp-server)
resource "aws_iam_role_policy" "ecr_push" {
  name = "${local.name}-ecr-push"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:DescribeRepositories",
          "ecr:ListImages"
        ]
        Resource = "arn:aws:ecr:*:*:repository/${var.name_prefix}-${var.env}-*"
      }
    ]
  })
}

S3 sync for dashboard deploy
resource "aws_iam_role_policy" "s3_dashboard" {
  name = "${local.name}-s3-dashboard"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:GetObject",
        "s3:ListBucket"
      ]
      Resource = [
        "arn:aws:s3:::${var.name_prefix}-${var.env}-dashboard",
        "arn:aws:s3:::${var.name_prefix}-${var.env}-dashboard/*"
      ]
    }]
  })
}

CloudFront invalidation for dashboard deploy
resource "aws_iam_role_policy" "cloudfront_invalidation" {
  name = "${local.name}-cloudfront-invalidation"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["cloudfront:CreateInvalidation"]
      Resource = "*"  # TODO: scope to specific distribution ARN once created
    }]
  })
}

SSM Send-Command for deploy-staging (trigger docker compose pull + up)
resource "aws_iam_role_policy" "ssm_send_command" {
  name = "${local.name}-ssm-send-command"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:SendCommand",
          "ssm:GetCommandInvocation"
        ]
        Resource = [
          "arn:aws:ssm:*:*:document/AWS-RunShellScript",
          "arn:aws:ec2:*:*:instance/*"
        ]
        Condition = {
          StringEquals = {
            "aws:ResourceTag/Environment" = var.env
            "aws:ResourceTag/Project"     = var.name_prefix
          }
        }
      }
    ]
  })
}
*/
