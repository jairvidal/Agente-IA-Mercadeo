# SKELETON — to be implemented in E-00.3/E-00.6.
# Resources are commented out so `terraform init` and `terraform plan` succeed
# without provisioning anything. Each TODO maps to a checkbox in sprint-1-prd.md.

locals {
  name     = "${var.name_prefix}-${var.env}"
  services = ["backend", "mcp-server", "postgres", "redis", "caddy"]
}

/*
TODO E-00.6: CloudWatch log groups (one per service, 14 days retention for staging)
resource "aws_cloudwatch_log_group" "services" {
  for_each          = toset(local.services)
  name              = "/${var.name_prefix}/${var.env}/${each.value}"
  retention_in_days = 14

  tags = {
    Name    = "${local.name}-log-${each.value}"
    Service = each.value
  }
}

TODO E-00.6: SNS topic for alarm notifications
resource "aws_sns_topic" "alerts" {
  name = "${local.name}-alerts"
  tags = { Name = "${local.name}-alerts" }
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alert_email != null ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

TODO E-00.6: CloudWatch alarm — EC2 CPU > 80% for 5 minutes
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "${local.name}-cpu-high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "EC2 CPU utilization > 80% for 10 min"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  # TODO: add dimension InstanceId = module.compute.instance_id
  # dimensions = { InstanceId = var.instance_id }
}

TODO E-00.6: CloudWatch alarm — AWS Billing > $50/month
resource "aws_cloudwatch_metric_alarm" "billing" {
  alarm_name          = "${local.name}-billing-high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "EstimatedCharges"
  namespace           = "AWS/Billing"
  period              = 86400
  statistic           = "Maximum"
  threshold           = 50
  alarm_description   = "AWS estimated charges > $50 USD"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    Currency = "USD"
  }
}
*/
