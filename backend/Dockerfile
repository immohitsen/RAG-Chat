# Use official AWS Lambda Python 3.11 image
FROM public.ecr.aws/lambda/python:3.12

# Set working directory inside /var/task (standard for Lambda)
WORKDIR ${LAMBDA_TASK_ROOT}

# Install system dependencies
RUN dnf install -y gcc-c++ make && dnf clean all

# Copy requirements.txt and install with optimizations
COPY requirements.txt .
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# Pre-download models during build so Lambda doesn't need internet at runtime
ENV SENTENCE_TRANSFORMERS_HOME=/var/task/model_cache
RUN mkdir -p /var/task/model_cache && \
    python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')" && \
    python -c "from sentence_transformers import CrossEncoder; CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')"

# Copy the rest of the backend source code
COPY . .

# Remove unnecessary files to reduce image size
RUN rm -rf data/ faiss_store/ __pycache__/ *.log *.zip 2>/dev/null || true

# Command to run the Lambda function
# Format: [filename].[handler_name]
CMD ["main.handler"]
