FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY reset_admin.py .

# Create directory for SQLite database
# Using /data as the standard volume mount point
RUN mkdir -p /data
ENV DATABASE_URL="sqlite+aiosqlite:////data/paper_llama.db"

EXPOSE 8021

# Start the FastAPI server
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8021"]
