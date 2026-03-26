FROM python:3.11-slim

# Prevent Python from writing .pyc files and buffer output
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Remove any existing __pycache__ directories and .pyc files
RUN find . -type d -name __pycache__ -exec rm -rf {} + || true
RUN find . -name "*.pyc" -delete || true

EXPOSE 7846

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7846"]
