# Dependency order:
#   1. network
#   2. registry + secrets + storage   (parallel)
#   3. compute                        (needs secrets)
#   4. frontend                       (needs storage)
#   5. observability  E-00.6          (parallel with compute)
#   6. github-oidc    E-00.5          (needs registry + storage + compute)

locals {
  env         = var.env
  name_prefix = var.name_prefix
}

# Step 1 — network (VPC, subnet, security groups)
module "network" {
  source              = "../../modules/network"
  name_prefix         = local.name_prefix
  env                 = local.env
  vpc_cidr            = "10.20.0.0/16"
  public_subnet_cidrs = ["10.20.1.0/24"]
}

# Step 2a — ECR repositories (backend, mcp-server)
module "registry" {
  source      = "../../modules/registry"
  name_prefix = local.name_prefix
  env         = local.env
  repos       = ["backend", "mcp-server"]
}

# Step 2b — Secrets Manager unified runtime blob
module "secrets" {
  source      = "../../modules/secrets"
  name_prefix = local.name_prefix
  env         = local.env
}

# Step 2c — S3 buckets (backups, dashboard, logs)
module "storage" {
  source      = "../../modules/storage"
  name_prefix = local.name_prefix
  env         = local.env
}

# Step 3 — IAM role + instance profile for EC2 (E-00.3)
#           EC2 instance + EIP activated in E-00.4 (ami_id, subnet_id, sg_id set there)
module "compute" {
  source      = "../../modules/compute"
  name_prefix = local.name_prefix
  env         = local.env
  secret_arn  = module.secrets.secret_arn
  vpc_id      = module.network.vpc_id
  subnet_id   = module.network.public_subnet_ids[0]
  sg_id       = module.network.sg_ec2_id
  # ami_id set in E-00.4 — verify latest Ubuntu 22.04 ARM64 AMI in us-east-1 before applying
}

# Step 4 — CloudFront + OAC for dashboard SPA
#           domain_name and acm_cert_arn null until SIDOC confirms domain
module "frontend" {
  source                           = "../../modules/frontend"
  name_prefix                      = local.name_prefix
  env                              = local.env
  dashboard_bucket_id              = module.storage.dashboard_bucket_id
  dashboard_bucket_regional_domain = module.storage.dashboard_bucket_regional_domain
  domain_name                      = var.domain_name
  acm_cert_arn                     = null
}

# Step 5 — CloudWatch observability — TODO E-00.6
# module "observability" {
#   source      = "../../modules/observability"
#   name_prefix = local.name_prefix
#   env         = local.env
#   alert_email = var.alert_email
# }

# Step 6 — GitHub Actions OIDC — TODO E-00.5
# module "github_oidc" {
#   source           = "../../modules/github-oidc"
#   name_prefix      = local.name_prefix
#   env              = local.env
#   github_org       = "morphux"
#   github_repo      = "Agente-IA-Mercadeo"
#   allowed_branches = ["main"]
# }
