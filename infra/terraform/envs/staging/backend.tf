terraform {
  backend "s3" {
    bucket       = "sidoc-ai-marketing-tfstate"
    key          = "staging/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = false
  }
}
