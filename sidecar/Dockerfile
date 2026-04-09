# Use the official Python lightweight image
FROM python:3.11-slim

# Prevent interactive prompts during apt-get install
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies required for OCR and PDF image extraction
# We install poppler-utils for pdf2image, and multiple Tesseract language packs
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-hin \
    tesseract-ocr-mar \
    tesseract-ocr-tam \
    tesseract-ocr-tel \
    tesseract-ocr-ben \
    tesseract-ocr-guj \
    tesseract-ocr-kan \
    tesseract-ocr-mal \
    tesseract-ocr-pan \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file and install Python packages
# This is done before copying the rest of the code to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application source code into the container
COPY . .

# Expose the correct port for the FastAPI server
EXPOSE 8100

# Start the Sidecar server using Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8100"]
