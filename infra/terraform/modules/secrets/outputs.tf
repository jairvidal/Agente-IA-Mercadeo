output "secret_arn" {
  description = "ARN of the runtime config secret (used by compute module for IAM policy)"
  value       = aws_secretsmanager_secret.runtime.arn
}

output "secret_name" {
  description = "Name of the runtime config secret"
  value       = aws_secretsmanager_secret.runtime.name
}
