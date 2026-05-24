# Build Frontend Assets (Tailwind compilation)
FROM node:20-slim AS frontend-builder
WORKDIR /build
COPY package*.json ./
RUN npm install --ignore-scripts
COPY tailwind.config.js ./
COPY frontend/ ./frontend/
RUN npm run build:css

# Main Python Runner Image
FROM python:3.11-slim
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY backend/ ./backend/
COPY frontend/ ./frontend/
# Overwrite style.css with the compiled version from Stage 1
COPY --from=frontend-builder /build/frontend/assets/style.css ./frontend/assets/style.css
COPY reset_admin.py .

# Create directory for SQLite database
# Using /data as the standard volume mount point
RUN mkdir -p /data
ENV DATABASE_URL="sqlite+aiosqlite:////data/paper_llama.db"

EXPOSE 8021

# Start the FastAPI server with automatic DB migrations
CMD sh -c "cd backend && alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8021"
