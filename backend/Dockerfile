# Use official AWS Lambda Python 3.11 image
FROM public.ecr.aws/lambda/python:3.12

# Set working directory inside /var/task (standard for Lambda)
WORKDIR ${LAMBDA_TASK_ROOT}

# Install system dependencies
RUN dnf install -y gcc-c++ make && dnf clean all

# Copy requirements.txt and install with optimizations
COPY requirements.txt .
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir --compile -r requirements.txt && \
    find ${LAMBDA_TASK_ROOT} -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true && \
    find ${LAMBDA_TASK_ROOT} -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true && \
    find ${LAMBDA_TASK_ROOT} -name "*.pyc" -delete 2>/dev/null || true

# Pre-download the embedding model so Lambda doesn't need internet access
ENV SENTENCE_TRANSFORMERS_HOME=/var/task/models
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Copy the rest of the backend source code
COPY . .

# Remove unnecessary files to reduce image size
RUN rm -rf data/ faiss_store/ __pycache__/ *.log *.zip 2>/dev/null || true

# Command to run the Lambda function
# Format: [filename].[handler_name]
CMD ["main.handler"]
