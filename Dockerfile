FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /workspace

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    default-libmysqlclient-dev \
    libmariadb-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY automation/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy both backend and frontend code to docker container
COPY automation/ /workspace/automation/
COPY frontend/ /workspace/frontend/

# Set working directory to the backend folder
WORKDIR /workspace/automation

# Expose port
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
