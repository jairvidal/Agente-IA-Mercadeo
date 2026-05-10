provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "sidoc-ai-marketing"
      Environment = var.env
      ManagedBy   = "Terraform"
      Owner       = "Morphux"
      CostCenter  = "OS-51468"
    }
  }
}
