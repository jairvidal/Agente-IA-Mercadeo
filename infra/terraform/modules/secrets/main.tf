# Secret values are NEVER managed by Terraform (lifecycle ignore_changes on secret_string).
# After apply, populate via CLI:
#   aws secretsmanager put-secret-value \
#     --secret-id /sidoc-ai-marketing/${var.env}/runtime \
#     --secret-string file://runtime.json

resource "aws_secretsmanager_secret" "runtime" {
  name                    = "/sidoc-ai-marketing/${var.env}/runtime"
  description             = "Unified runtime config for ${var.env} environment"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.name_prefix}-${var.env}-runtime-secret"
  }
}

resource "aws_secretsmanager_secret_version" "runtime" {
  secret_id     = aws_secretsmanager_secret.runtime.id
  secret_string = jsonencode({ PLACEHOLDER = "populate-via-cli-before-first-deploy" })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
