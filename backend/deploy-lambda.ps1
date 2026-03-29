# AWS Lambda Deployment Script for RAG Backend (PowerShell)
# Prerequisites: AWS CLI configured with credentials

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting AWS Lambda Deployment..." -ForegroundColor Green

# Configuration
$AWS_REGION = if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-east-1" }
$ECR_REPO_NAME = "rag-backend"
$LAMBDA_FUNCTION_NAME = "rag-backend-api"
$LAMBDA_ROLE_NAME = "rag-lambda-execution-role"
$IMAGE_TAG = "latest"

# Get AWS Account ID
$AWS_ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
$ECR_REPOSITORY_URI = "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME"

Write-Host "📝 AWS Account ID: $AWS_ACCOUNT_ID" -ForegroundColor Cyan
Write-Host "📝 Region: $AWS_REGION" -ForegroundColor Cyan
Write-Host "📝 ECR Repository: $ECR_REPOSITORY_URI" -ForegroundColor Cyan

# Step 1: Create ECR repository if it doesn't exist
Write-Host "`n📦 Step 1: Creating ECR repository..." -ForegroundColor Yellow
try {
    aws ecr describe-repositories --repository-names $ECR_REPO_NAME --region $AWS_REGION 2>$null
} catch {
    aws ecr create-repository --repository-name $ECR_REPO_NAME --region $AWS_REGION
}

# Step 2: Authenticate Docker to ECR
Write-Host "`n🔐 Step 2: Authenticating Docker to ECR..." -ForegroundColor Yellow
$password = aws ecr get-login-password --region $AWS_REGION
$password | docker login --username AWS --password-stdin $ECR_REPOSITORY_URI

# Step 3: Build Docker image
Write-Host "`n🔨 Step 3: Building Docker image..." -ForegroundColor Yellow
docker build -t ${ECR_REPO_NAME}:${IMAGE_TAG} .

# Step 4: Tag Docker image
Write-Host "`n🏷️  Step 4: Tagging Docker image..." -ForegroundColor Yellow
docker tag ${ECR_REPO_NAME}:${IMAGE_TAG} ${ECR_REPOSITORY_URI}:${IMAGE_TAG}

# Step 5: Push to ECR
Write-Host "`n⬆️  Step 5: Pushing to ECR..." -ForegroundColor Yellow
docker push ${ECR_REPOSITORY_URI}:${IMAGE_TAG}

# Step 6: Create IAM role for Lambda if it doesn't exist
Write-Host "`n👤 Step 6: Setting up IAM role..." -ForegroundColor Yellow
try {
    $roleExists = aws iam get-role --role-name $LAMBDA_ROLE_NAME 2>$null
} catch {
    Write-Host "Creating IAM role..." -ForegroundColor Cyan
    $trustPolicy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
"@
    $trustPolicy | Out-File -FilePath trust-policy.json -Encoding utf8

    aws iam create-role `
        --role-name $LAMBDA_ROLE_NAME `
        --assume-role-policy-document file://trust-policy.json

    # Attach basic Lambda execution policy
    aws iam attach-role-policy `
        --role-name $LAMBDA_ROLE_NAME `
        --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

    Write-Host "Waiting 10 seconds for IAM role to propagate..." -ForegroundColor Cyan
    Start-Sleep -Seconds 10
    Remove-Item trust-policy.json
}

$LAMBDA_ROLE_ARN = aws iam get-role --role-name $LAMBDA_ROLE_NAME --query Role.Arn --output text
Write-Host "✅ Lambda Role ARN: $LAMBDA_ROLE_ARN" -ForegroundColor Green

# Step 7: Create or update Lambda function
Write-Host "`n⚡ Step 7: Creating/Updating Lambda function..." -ForegroundColor Yellow

# Load environment variables
$GROQ_API_KEY = $env:GROQ_API_KEY
$MONGODB_URI = $env:MONGODB_URI

if (!$GROQ_API_KEY -or !$MONGODB_URI) {
    Write-Host "⚠️  Warning: GROQ_API_KEY or MONGODB_URI not set in environment" -ForegroundColor Red
    Write-Host "Loading from .env file..." -ForegroundColor Cyan
    if (Test-Path "../.env") {
        Get-Content "../.env" | ForEach-Object {
            if ($_ -match '^([^=]+)=(.*)$') {
                $key = $matches[1].Trim('"')
                $value = $matches[2].Trim('"')
                Set-Item -Path "env:$key" -Value $value
            }
        }
        $GROQ_API_KEY = $env:GROQ_API_KEY
        $MONGODB_URI = $env:MONGODB_URI
    }
}

$envVars = "{GROQ_API_KEY=$GROQ_API_KEY,MONGODB_URI=$MONGODB_URI}"

try {
    $functionExists = aws lambda get-function --function-name $LAMBDA_FUNCTION_NAME --region $AWS_REGION 2>$null
    Write-Host "Updating existing Lambda function..." -ForegroundColor Cyan

    aws lambda update-function-code `
        --function-name $LAMBDA_FUNCTION_NAME `
        --image-uri ${ECR_REPOSITORY_URI}:${IMAGE_TAG} `
        --region $AWS_REGION

    aws lambda wait function-updated --function-name $LAMBDA_FUNCTION_NAME --region $AWS_REGION

    aws lambda update-function-configuration `
        --function-name $LAMBDA_FUNCTION_NAME `
        --timeout 900 `
        --memory-size 2048 `
        --environment "Variables=$envVars" `
        --region $AWS_REGION
} catch {
    Write-Host "Creating new Lambda function..." -ForegroundColor Cyan
    aws lambda create-function `
        --function-name $LAMBDA_FUNCTION_NAME `
        --package-type Image `
        --code ImageUri=${ECR_REPOSITORY_URI}:${IMAGE_TAG} `
        --role $LAMBDA_ROLE_ARN `
        --timeout 900 `
        --memory-size 2048 `
        --environment "Variables=$envVars" `
        --region $AWS_REGION
}

# Step 8: Create Lambda Function URL
Write-Host "`n🌐 Step 8: Setting up Function URL..." -ForegroundColor Yellow
try {
    $FUNCTION_URL = aws lambda create-function-url-config `
        --function-name $LAMBDA_FUNCTION_NAME `
        --auth-type NONE `
        --cors '{\"AllowOrigins\":[\"*\"],\"AllowMethods\":[\"*\"],\"AllowHeaders\":[\"*\"],\"MaxAge\":86400}' `
        --region $AWS_REGION `
        --query FunctionUrl --output text 2>$null
} catch {
    $FUNCTION_URL = aws lambda get-function-url-config `
        --function-name $LAMBDA_FUNCTION_NAME `
        --region $AWS_REGION `
        --query FunctionUrl --output text
}

# Add public invoke permission
try {
    aws lambda add-permission `
        --function-name $LAMBDA_FUNCTION_NAME `
        --statement-id FunctionURLAllowPublicAccess `
        --action lambda:InvokeFunctionUrl `
        --principal "*" `
        --function-url-auth-type NONE `
        --region $AWS_REGION 2>$null
} catch {
    Write-Host "Permission already exists" -ForegroundColor Gray
}

Write-Host "`n✅ ==========================================" -ForegroundColor Green
Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host "✅ ==========================================" -ForegroundColor Green
Write-Host "`n🌐 Function URL: $FUNCTION_URL" -ForegroundColor Cyan
Write-Host "`nTest your API:" -ForegroundColor Yellow
Write-Host "curl $FUNCTION_URL" -ForegroundColor White
Write-Host "`nUpdate frontend VITE_API_URL with: $FUNCTION_URL" -ForegroundColor Yellow
