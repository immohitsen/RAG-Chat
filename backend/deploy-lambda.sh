#!/bin/bash

# AWS Lambda Deployment Script for RAG Backend
# Prerequisites: AWS CLI configured with credentials

set -e

echo "🚀 Starting AWS Lambda Deployment..."

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
ECR_REPO_NAME="rag-backend"
LAMBDA_FUNCTION_NAME="rag-backend-api"
LAMBDA_ROLE_NAME="rag-lambda-execution-role"
IMAGE_TAG="latest"

# Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPOSITORY_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}"

echo "📝 AWS Account ID: ${AWS_ACCOUNT_ID}"
echo "📝 Region: ${AWS_REGION}"
echo "📝 ECR Repository: ${ECR_REPOSITORY_URI}"

# Step 1: Create ECR repository if it doesn't exist
echo ""
echo "📦 Step 1: Creating ECR repository..."
aws ecr describe-repositories --repository-names ${ECR_REPO_NAME} --region ${AWS_REGION} 2>/dev/null || \
    aws ecr create-repository --repository-name ${ECR_REPO_NAME} --region ${AWS_REGION}

# Step 2: Authenticate Docker to ECR
echo ""
echo "🔐 Step 2: Authenticating Docker to ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REPOSITORY_URI}

# Step 3: Build Docker image
echo ""
echo "🔨 Step 3: Building Docker image..."
docker build -t ${ECR_REPO_NAME}:${IMAGE_TAG} .

# Step 4: Tag Docker image
echo ""
echo "🏷️  Step 4: Tagging Docker image..."
docker tag ${ECR_REPO_NAME}:${IMAGE_TAG} ${ECR_REPOSITORY_URI}:${IMAGE_TAG}

# Step 5: Push to ECR
echo ""
echo "⬆️  Step 5: Pushing to ECR..."
docker push ${ECR_REPOSITORY_URI}:${IMAGE_TAG}

# Step 6: Create IAM role for Lambda if it doesn't exist
echo ""
echo "👤 Step 6: Setting up IAM role..."
if ! aws iam get-role --role-name ${LAMBDA_ROLE_NAME} 2>/dev/null; then
    echo "Creating IAM role..."
    cat > /tmp/trust-policy.json <<EOF
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
EOF

    aws iam create-role \
        --role-name ${LAMBDA_ROLE_NAME} \
        --assume-role-policy-document file:///tmp/trust-policy.json

    # Attach basic Lambda execution policy
    aws iam attach-role-policy \
        --role-name ${LAMBDA_ROLE_NAME} \
        --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

    echo "Waiting 10 seconds for IAM role to propagate..."
    sleep 10
fi

LAMBDA_ROLE_ARN=$(aws iam get-role --role-name ${LAMBDA_ROLE_NAME} --query Role.Arn --output text)
echo "✅ Lambda Role ARN: ${LAMBDA_ROLE_ARN}"

# Step 7: Create or update Lambda function
echo ""
echo "⚡ Step 7: Creating/Updating Lambda function..."
if aws lambda get-function --function-name ${LAMBDA_FUNCTION_NAME} --region ${AWS_REGION} 2>/dev/null; then
    echo "Updating existing Lambda function..."
    aws lambda update-function-code \
        --function-name ${LAMBDA_FUNCTION_NAME} \
        --image-uri ${ECR_REPOSITORY_URI}:${IMAGE_TAG} \
        --region ${AWS_REGION}

    aws lambda wait function-updated --function-name ${LAMBDA_FUNCTION_NAME} --region ${AWS_REGION}

    aws lambda update-function-configuration \
        --function-name ${LAMBDA_FUNCTION_NAME} \
        --timeout 900 \
        --memory-size 2048 \
        --environment Variables="{GROQ_API_KEY=${GROQ_API_KEY},MONGODB_URI=${MONGODB_URI}}" \
        --region ${AWS_REGION}
else
    echo "Creating new Lambda function..."
    aws lambda create-function \
        --function-name ${LAMBDA_FUNCTION_NAME} \
        --package-type Image \
        --code ImageUri=${ECR_REPOSITORY_URI}:${IMAGE_TAG} \
        --role ${LAMBDA_ROLE_ARN} \
        --timeout 900 \
        --memory-size 2048 \
        --environment Variables="{GROQ_API_KEY=${GROQ_API_KEY},MONGODB_URI=${MONGODB_URI}}" \
        --region ${AWS_REGION}
fi

# Step 8: Create Lambda Function URL (simpler than API Gateway)
echo ""
echo "🌐 Step 8: Setting up Function URL..."
FUNCTION_URL=$(aws lambda create-function-url-config \
    --function-name ${LAMBDA_FUNCTION_NAME} \
    --auth-type NONE \
    --cors '{"AllowOrigins":["*"],"AllowMethods":["*"],"AllowHeaders":["*"],"MaxAge":86400}' \
    --region ${AWS_REGION} \
    --query FunctionUrl --output text 2>/dev/null || \
    aws lambda get-function-url-config \
        --function-name ${LAMBDA_FUNCTION_NAME} \
        --region ${AWS_REGION} \
        --query FunctionUrl --output text)

# Add public invoke permission
aws lambda add-permission \
    --function-name ${LAMBDA_FUNCTION_NAME} \
    --statement-id FunctionURLAllowPublicAccess \
    --action lambda:InvokeFunctionUrl \
    --principal "*" \
    --function-url-auth-type NONE \
    --region ${AWS_REGION} 2>/dev/null || echo "Permission already exists"

echo ""
echo "✅ =========================================="
echo "✅ Deployment Complete!"
echo "✅ =========================================="
echo ""
echo "🌐 Function URL: ${FUNCTION_URL}"
echo ""
echo "Test your API:"
echo "curl ${FUNCTION_URL}"
echo ""
echo "Update frontend VITE_API_URL with: ${FUNCTION_URL}"
