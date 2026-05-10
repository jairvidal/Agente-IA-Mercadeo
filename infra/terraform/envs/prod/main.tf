# SKELETON — to be implemented after staging is validated.
# Do NOT apply prod before staging smoke tests pass (sprint-1-prd.md E-00.8).
#
# Dependency order: same as staging/main.tf

locals {
  env         = var.env
  name_prefix = var.name_prefix
}

# TODO: uncomment after staging validation — mirror staging/main.tf with prod variables

# module "network" {
#   source              = "../../modules/network"
#   name_prefix         = local.name_prefix
#   env                 = local.env
#   vpc_cidr            = "10.21.0.0/16"
#   public_subnet_cidrs = ["10.21.1.0/24"]
# }

# module "registry" {
#   source      = "../../modules/registry"
#   name_prefix = local.name_prefix
#   env         = local.env
#   repos       = ["backend", "mcp-server"]
# }

# module "secrets" {
#   source      = "../../modules/secrets"
#   name_prefix = local.name_prefix
#   env         = local.env
# }

# module "storage" {
#   source      = "../../modules/storage"
#   name_prefix = local.name_prefix
#   env         = local.env
# }

# module "compute" {
#   source        = "../../modules/compute"
#   name_prefix   = local.name_prefix
#   env           = local.env
#   vpc_id        = module.network.vpc_id
#   subnet_id     = module.network.public_subnet_ids[0]
#   sg_id         = module.network.sg_ec2_id
#   instance_type = "t4g.small"
#   ami_id        = "ami-0c7217cdde317cfec"  # Ubuntu 22.04 ARM64 us-east-1 — verify current AMI
#   secret_arn    = module.secrets.secret_arn
# }

# module "frontend" {
#   source                           = "../../modules/frontend"
#   name_prefix                      = local.name_prefix
#   env                              = local.env
#   dashboard_bucket_id              = module.storage.dashboard_bucket_id
#   dashboard_bucket_regional_domain = module.storage.dashboard_bucket_regional_domain
#   domain_name                      = var.domain_name
#   acm_cert_arn                     = null
# }

# module "observability" {
#   source      = "../../modules/observability"
#   name_prefix = local.name_prefix
#   env         = local.env
#   alert_email = var.alert_email
# }

# module "github_oidc" {
#   source           = "../../modules/github-oidc"
#   name_prefix      = local.name_prefix
#   env              = local.env
#   github_org       = "morphux"
#   github_repo      = "Agente-IA-Mercadeo"
#   allowed_branches = ["main"]
# }
