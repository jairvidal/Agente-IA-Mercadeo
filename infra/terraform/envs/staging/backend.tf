terraform {
  backend "s3" {
    bucket         = "sidoc-ai-marketing-tfstate"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "sidoc-ai-marketing-tflock"
    encrypt        = true
  }
}
