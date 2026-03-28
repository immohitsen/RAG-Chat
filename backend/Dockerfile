# Use Python 3.11 slim for a smaller image size
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV PORT 8080

# Install system dependencies needed for some Python packages
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend source code
COPY . .

# Expose the port (Hugging Face default is 7860)
EXPOSE 8080

# Command to run the application
# We use uvicorn to serve the FastAPI app
CMD ["python", "main.py"]
