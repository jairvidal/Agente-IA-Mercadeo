# SKELETON — outputs are commented until resources are uncommented in main.tf

# output "log_group_names" {
#   description = "CloudWatch log group names per service"
#   value       = { for k, v in aws_cloudwatch_log_group.services : k => v.name }
# }

# output "sns_topic_arn" {
#   description = "SNS topic ARN for alarm notifications"
#   value       = aws_sns_topic.alerts.arn
# }
