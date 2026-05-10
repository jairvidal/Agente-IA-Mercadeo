terraform {
  backend "s3" {
    bucket         = "sidoc-ai-marketing-tfstate"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "sidoc-ai-marketing-tflock"
    encrypt        = true
  }
}
