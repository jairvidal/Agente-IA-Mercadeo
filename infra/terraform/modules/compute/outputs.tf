output "instance_profile_arn" {
  description = "IAM instance profile ARN (attach to EC2 in E-00.4)"
  value       = aws_iam_instance_profile.ec2.arn
}

output "ec2_role_arn" {
  description = "IAM role ARN for EC2"
  value       = aws_iam_role.ec2.arn
}

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.main.id
}

output "public_ip" {
  description = "Elastic IP address (static public IP for Telegram webhook + sslip.io domain)"
  value       = aws_eip.main.public_ip
}

output "eip_id" {
  description = "Elastic IP allocation ID"
  value       = aws_eip.main.id
}

output "ami_id" {
  description = "AMI ID used for the EC2 instance (resolved from data source if not provided)"
  value       = local.resolved_ami_id
}
