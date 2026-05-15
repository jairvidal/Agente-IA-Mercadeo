locals {
  name = "${var.name_prefix}-${var.env}"
}

# --- IAM (E-00.3) ---

resource "aws_iam_role" "ec2" {
  name = "${local.name}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "ec2_secrets" {
  name = "${local.name}-ec2-secrets-policy"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
      Resource = var.secret_arn
    }]
  })
}

# SSM Session Manager — allows shell access without opening SSH port
resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${local.name}-ec2-profile"
  role = aws_iam_role.ec2.name
}

# --- EC2 instance (E-00.4) ---

data "aws_region" "current" {}

data "aws_ami" "ubuntu_arm64" {
  count       = var.ami_id == null ? 1 : 0
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-arm64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "root-device-type"
    values = ["ebs"]
  }
}

locals {
  resolved_ami_id = var.ami_id != null ? var.ami_id : data.aws_ami.ubuntu_arm64[0].id
  secret_id       = "/${var.name_prefix}/${var.env}/runtime"
}

resource "aws_instance" "main" {
  ami                    = local.resolved_ami_id
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [var.sg_id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name

  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
    http_endpoint               = "enabled"
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 20
    delete_on_termination = true
    encrypted             = true
  }

  user_data = base64encode(templatefile("${path.module}/user_data.sh.tftpl", {
    env        = var.env
    secret_id  = local.secret_id
    aws_region = data.aws_region.current.name
  }))

  tags = {
    Name        = "${local.name}-ec2"
    Environment = var.env
    Project     = var.name_prefix
  }

  lifecycle {
    ignore_changes = [ami, user_data]
  }
}

resource "aws_eip" "main" {
  domain = "vpc"
  tags   = { Name = "${local.name}-eip" }
}

resource "aws_eip_association" "main" {
  instance_id   = aws_instance.main.id
  allocation_id = aws_eip.main.id
}

resource "aws_cloudwatch_metric_alarm" "ec2_auto_recovery" {
  alarm_name          = "${local.name}-ec2-auto-recovery"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "StatusCheckFailed_System"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Minimum"
  threshold           = 1
  alarm_actions       = ["arn:aws:automate:${data.aws_region.current.name}:ec2:recover"]
  dimensions          = { InstanceId = aws_instance.main.id }
}
