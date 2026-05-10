output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "sg_ec2_id" {
  description = "Security group ID for EC2 instances"
  value       = aws_security_group.ec2.id
}
