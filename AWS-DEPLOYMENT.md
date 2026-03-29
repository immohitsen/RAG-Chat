# AWS Lambda Deployment Guide for RAG Backend

## Prerequisites

1. **Docker Desktop** installed and running
   - Download: https://www.docker.com/products/docker-desktop/

2. **AWS CLI** installed ✅ (Already installed)
   ```bash
   aws --version
   ```

3. **AWS Account** with credentials configured
   ```bash
   aws configure
   ```
   You'll need:
   - AWS Access Key ID
   - AWS Secret Access Key
   - Default region (e.g., us-east-1)
   - Output format: json

4. **Environment Variables** (from .env file)
   - GROQ_API_KEY
   - MONGODB_URI

## Deployment Steps

### Option 1: PowerShell (Windows) - Recommended

```powershell
cd backend
./deploy-lambda.ps1
```

### Option 2: Bash (Git Bash/WSL)

```bash
cd backend
chmod +x deploy-lambda.sh
./deploy-lambda.sh
```

## What the Script Does

1. ✅ Creates ECR (Elastic Container Registry) repository
2. ✅ Authenticates Docker with AWS
3. ✅ Builds Docker image with optimizations
4. ✅ Pushes image to ECR
5. ✅ Creates IAM role for Lambda
6. ✅ Creates/Updates Lambda function
7. ✅ Sets up Function URL (no API Gateway needed!)
8. ✅ Configures CORS for frontend

## After Deployment

You'll get a Function URL like:
```
https://xxxxxxxxxxxxxx.lambda-url.us-east-1.on.aws/
```

### Test Your API

```bash
# Health check
curl https://your-function-url.lambda-url.us-east-1.on.aws/api/health

# Root endpoint
curl https://your-function-url.lambda-url.us-east-1.on.aws/
```

### Update Frontend

1. Open `frontend/.env` or create it:
   ```env
   VITE_API_URL=https://your-function-url.lambda-url.us-east-1.on.aws
   ```

2. Rebuild frontend:
   ```bash
   cd frontend
   npm run build
   ```

## Cost Estimate (Free Tier)

AWS Lambda Free Tier includes:
- **1M requests per month** - FREE
- **400,000 GB-seconds of compute time** - FREE

Your configuration:
- Memory: 2048 MB (2 GB)
- Timeout: 900 seconds (15 min)
- Free tier gives: 400,000 / 2 = **200,000 seconds = ~55 hours** of execution time

**Estimated free usage:**
- ~2,200 requests/month at 900s each = FREE
- Or ~220,000 requests at 90s each = FREE

After free tier: ~$0.0000166667 per GB-second

## Important Lambda Limits

⚠️ **Size Limits:**
- Docker image: 10 GB (should be fine)
- Unzipped: 250 MB (might be tight with ML models)
- Ephemeral storage: 512 MB - 10 GB

⚠️ **Cold Start:**
- First request after idle: 5-10 seconds
- Container image cold start: slower than ZIP

⚠️ **Memory:**
- Set to 2048 MB (2 GB) for ML models
- Increase if OOM errors occur

## Troubleshooting

### 1. Docker not found
**Error:** `docker: command not found`
**Fix:** Install Docker Desktop and ensure it's running

### 2. AWS credentials not configured
**Error:** `Unable to locate credentials`
**Fix:**
```bash
aws configure
# Enter your AWS Access Key ID and Secret
```

### 3. Image too large
**Error:** `RequestEntityTooLargeException`
**Fix:** The sentence-transformers model might be too heavy. Consider:
- Using Groq embeddings API instead
- Switching to a smaller model
- Using ECS/Fargate instead of Lambda

### 4. Function timeout
**Error:** `Task timed out after 900.00 seconds`
**Fix:** Increase timeout (max 15 min) or optimize code

### 5. Out of memory
**Error:** `Runtime exited with error: signal: killed`
**Fix:** Increase memory in script (currently 2048 MB, max 10240 MB)

## Update Deployment

To update after code changes:

```bash
cd backend
./deploy-lambda.ps1  # or ./deploy-lambda.sh
```

The script will:
- Rebuild Docker image
- Push new version to ECR
- Update Lambda function automatically

## Delete Resources

To remove all AWS resources:

```bash
# Delete Lambda function
aws lambda delete-function --function-name rag-backend-api --region us-east-1

# Delete ECR repository
aws ecr delete-repository --repository-name rag-backend --force --region us-east-1

# Delete IAM role (detach policies first)
aws iam detach-role-policy --role-name rag-lambda-execution-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam delete-role --role-name rag-lambda-execution-role
```

## Alternative: Deploy to ECS (If Lambda fails)

If the Docker image is too large or cold starts are problematic, use ECS:

```bash
# Will create separate ECS deployment script if needed
```

## Frontend Deployment (Free Options)

### Vercel (Recommended)
```bash
cd frontend
npm install -g vercel
vercel
```

### Netlify
```bash
cd frontend
npm run build
npm install -g netlify-cli
netlify deploy
```

## Monitoring

View logs in AWS CloudWatch:
```bash
aws logs tail /aws/lambda/rag-backend-api --follow --region us-east-1
```

Or in AWS Console:
CloudWatch → Log groups → /aws/lambda/rag-backend-api

## Support

If deployment fails, check:
1. Docker is running
2. AWS credentials are valid: `aws sts get-caller-identity`
3. Region is correct (default: us-east-1)
4. No firewall blocking Docker/AWS

---

**Next Steps:**
1. Run deployment script
2. Test the Function URL
3. Update frontend with API URL
4. Deploy frontend to Vercel
5. Share your app! 🚀
