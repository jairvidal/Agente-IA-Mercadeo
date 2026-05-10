# Terraform — sidoc-ai-marketing

Infrastructure as Code for the **Agente IA Mercadeo SIDOC** project (contract OS-51468).
Decision rationale: [ADR-001](../../projects/docs/Agente-IA-Mercadeo/docs/architecture/adr-001-iac-tool.md).

## Prerequisites (one-time bootstrap)

Before running `terraform init`, create the state backend manually:

```bash
# Create S3 bucket for Terraform state (us-east-1)
aws s3api create-bucket \
  --bucket sidoc-ai-marketing-tfstate \
  --region us-east-1

aws s3api put-bucket-versioning \
  --bucket sidoc-ai-marketing-tfstate \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket sidoc-ai-marketing-tfstate \
  --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# Create DynamoDB lock table
aws dynamodb create-table \
  --table-name sidoc-ai-marketing-tflock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

## Credentials

Terraform uses the AWS Go SDK, which only reads standard credential sources
(`~/.aws/credentials`, `~/.aws/sso/cache/`, env vars, IMDS). If you authenticate
via a company tool that writes elsewhere (e.g. `~/.aws/login/`), the SDK will
not see your session.

**Recommended pattern**: use `direnv` + `aws configure export-credentials`.

```bash
# One-time setup
brew install direnv
# Add `eval "$(direnv hook zsh)"` (or bash) to your shell rc

# Per environment
cd envs/staging
cp .envrc.example .envrc
direnv allow
```

When you `cd` into the directory, `direnv` exports short-lived session creds
into env vars. Re-export when the session expires (re-login + `direnv reload`).

> **Production must use AWS Identity Center** (SSO) with named profiles. Static
> keys in `~/.aws/credentials` are forbidden.

## Workflow

```bash
# 1. Go to the target environment
cd envs/staging

# 2. Initialize (downloads providers, configures backend)
terraform init

# 3. Preview changes
terraform plan -var-file=terraform.tfvars

# 4. Apply
terraform apply -var-file=terraform.tfvars

# 5. After apply: populate the runtime secret manually (do NOT put secrets in .tf files)
aws secretsmanager put-secret-value \
  --secret-id /sidoc-ai-marketing/staging/runtime \
  --secret-string file://runtime-staging.json
```

## Naming convention

All resources follow: `sidoc-ai-marketing-{env}-{resource}`

Examples:
- `sidoc-ai-marketing-staging-ec2`
- `sidoc-ai-marketing-staging-dashboard`
- `sidoc-ai-marketing-prod-ecr-backend`

## Module dependency order

```
1. network
2. registry, secrets, storage   (parallel — no mutual deps)
3. compute                      (needs network + secrets)
4. frontend                     (needs storage.dashboard_bucket)
5. observability                (parallel with compute)
6. github-oidc                  (needs registry + storage + compute)
```

## Environments

| Environment | State key | Backend |
|---|---|---|
| staging | `staging/terraform.tfstate` | `s3://sidoc-ai-marketing-tfstate` |
| prod | `prod/terraform.tfstate` | `s3://sidoc-ai-marketing-tfstate` |

## Important rules

- **Never** run `terraform apply` from a personal laptop without pulling from `main` first.
- **Never** modify resources in the AWS console — use Terraform or `refresh-secrets.yml` workflow.
- `.terraform.lock.hcl` **must** be committed (provider version pinning).
- `*.tfvars` (with real values) **must NOT** be committed — use `*.tfvars.example` as template.
- Runtime secrets are **never** in Terraform state — see `modules/secrets/` and ADR-003.

## Runbook

See [`learning/aws/11-runbook-deploy.md`](../../../../learning/aws/11-runbook-deploy.md).

## Cost estimate (staging + prod)

| Service | Monthly est. |
|---|---|
| EC2 t4g.small × 2 | ~$24 |
| Elastic IP × 2 | ~$7.20 |
| ECR storage | ~$0.50 |
| Secrets Manager × 2 | ~$0.80 |
| S3 + CloudFront | ~$1-3 |
| CloudWatch | ~$2 |
| **Total** | **~$36-40/mo** |
